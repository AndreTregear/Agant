#!/usr/bin/env python3
"""Local LLM Wiki — Karpathy-pattern ingestion for text/audio/video/web/images.

Endpoints (override via env):
  YAYA_LLM_URL     default http://localhost:8081/v1/chat/completions
  YAYA_AUDIO_URL   default http://localhost:8082
  YAYA_MODEL       default agentyaya/yaya.v1
  YAYA_WIKI_ROOT   default /home/yaya/wiki

Usage:
  wiki.py ingest <path-or-url>
  wiki.py query "..."  [--speak]
  wiki.py lint
  wiki.py say "..."
"""

import argparse
import base64
import hashlib
import json
import mimetypes
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import requests

NL = "\n"

ROOT = Path(os.environ.get("YAYA_WIKI_ROOT", "/home/yaya/wiki"))
LLM_URL = os.environ.get("YAYA_LLM_URL", "http://localhost:8081/v1/chat/completions")
AUDIO_URL = os.environ.get("YAYA_AUDIO_URL", "http://localhost:8082").rstrip("/")
MODEL = os.environ.get("YAYA_MODEL", "agentyaya/yaya.v1")

RAW = ROOT / "raw"
WIKI = ROOT / "wiki"
PAGES = WIKI / "pages"
INDEX = WIKI / "index.md"
LOG = WIKI / "log.md"
SCHEMA = ROOT / "CLAUDE.md"

AUDIO_EXT = {".wav", ".mp3", ".m4a", ".ogg", ".flac"}
VIDEO_EXT = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
TEXT_EXT = {".txt", ".md", ".markdown", ".rst"}
PDF_EXT = {".pdf"}


def ensure_dirs():
    for d in [RAW, RAW / "audio", RAW / "video", RAW / "documents",
              RAW / "web", RAW / "images", WIKI, PAGES]:
        d.mkdir(parents=True, exist_ok=True)
    if not INDEX.exists():
        INDEX.write_text("# Wiki Index\n\n_LLM-maintained catalog. Pages live in `pages/`._\n\n")
    if not LOG.exists():
        LOG.write_text("# Ingestion Log\n")


def llm(messages, *, max_tokens=8000, temperature=0.2, json_mode=False):
    payload = {"model": MODEL, "messages": messages,
               "max_tokens": max_tokens, "temperature": temperature}
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    r = requests.post(LLM_URL, json=payload, timeout=1800)
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


def _strip_think(s: str) -> str:
    # yaya.v1 emits <think>/<thinking> reasoning blocks; drop them.
    for tag in ("think", "thinking", "reasoning"):
        s = re.sub(rf"<{tag}\b[^>]*>.*?</{tag}>", "", s, flags=re.S | re.I)
    return s


def extract_json(s: str):
    s = _strip_think(s).strip()
    # Prefer ```json fences, else any ``` fence, else balanced braces.
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", s, re.S)
    if m:
        return json.loads(m.group(1))
    start, end = s.find("{"), s.rfind("}")
    if start >= 0 and end > start:
        return json.loads(s[start:end + 1])
    raise json.JSONDecodeError("no JSON object found", s or "", 0)


# ---------------- Extractors ----------------
def extract_text_file(path: Path) -> str:
    return path.read_text(errors="replace")


def extract_pdf(path: Path) -> str:
    try:
        from pypdf import PdfReader
    except ImportError:
        sys.exit("pip install pypdf to ingest PDFs")
    return "\n\n".join((p.extract_text() or "") for p in PdfReader(str(path)).pages)


def extract_audio(path: Path) -> str:
    with open(path, "rb") as f:
        r = requests.post(f"{AUDIO_URL}/stt",
                          files={"file": (path.name, f)}, timeout=3600)
    r.raise_for_status()
    try:
        data = r.json()
        return data.get("text") or data.get("transcription") or json.dumps(data)
    except ValueError:
        return r.text


def extract_url(url: str):
    r = requests.get(url, timeout=120,
                     headers={"User-Agent": "yaya-wiki/1.0"})
    r.raise_for_status()
    html = r.text
    slug = hashlib.sha1(url.encode()).hexdigest()[:10]
    cached = RAW / "web" / f"{slug}.html"
    cached.write_text(html, errors="replace")
    try:
        import html2text
        h = html2text.HTML2Text()
        h.ignore_images = False
        h.body_width = 0
        txt = h.handle(html)
    except ImportError:
        txt = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.S | re.I)
        txt = re.sub(r"<style[^>]*>.*?</style>", " ", txt, flags=re.S | re.I)
        txt = re.sub(r"<[^>]+>", " ", txt)
        txt = re.sub(r"\s+", " ", txt)
    # Prepend URL + cache path so the LLM can cite both
    header = f"URL: {url}\nCached: raw/web/{slug}.html\n\n"
    return header + txt, url


def analyze_image(path: Path) -> str:
    b64 = base64.b64encode(path.read_bytes()).decode()
    mime = mimetypes.guess_type(path.name)[0] or "image/png"
    return llm([{"role": "user", "content": [
        {"type": "text", "text":
            "Describe this image in detail. Extract all visible text (OCR), "
            "diagrams, data, entities, quotes, and notable facts."},
        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
    ]}], max_tokens=4000)


def analyze_video(path: Path) -> str:
    return llm([{"role": "user", "content": [
        {"type": "text", "text":
            "Transcribe speech and describe visuals throughout the video. "
            "Extract key facts, named entities, verbatim quotes, timestamps "
            "of notable moments, and end with a structured summary."},
        {"type": "video_url", "video_url": {"url": f"file://{path.resolve()}"}},
    ]}], max_tokens=16000)


# ---------------- Ingest core ----------------
def read_wiki_state():
    pages = {p.name: p.read_text() for p in sorted(PAGES.glob("*.md"))}
    return {
        "schema": SCHEMA.read_text(),
        "index": INDEX.read_text(),
        "pages": pages,
    }


INGEST_SYS = """You are the compiler for an LLM Wiki following Karpathy's llm-wiki pattern.

Input: the wiki schema, current index.md, all existing pages, and a new source's
extracted content.

Output (ONLY this, wrapped in ```json fences):
{
  "log_entry": "concise one-line title",
  "operations": [
    {"action": "write", "path": "pages/<slug>.md", "content": "<FULL file content>"},
    {"action": "write", "path": "index.md", "content": "<FULL updated index>"}
  ]
}

Rules:
- Slugs are lowercase-kebab, topic-oriented (e.g. `transformer-architecture`),
  NOT source-filename-oriented.
- Extract multiple entity pages when a source covers multiple topics.
- When updating an existing page, return FULL new content (not a diff).
- Every page MUST start with `**Sources:**` listing raw/ paths or URLs.
- Cross-link related pages with `[[slug]]`.
- Keep `index.md` organized by category; include every page.
- Return ONLY the JSON object in ```json fences. No prose outside the fences.
"""


def compile_and_apply(source_id: str, content: str, kind: str):
    state = read_wiki_state()
    existing = NL.join(
        f"--- {name} ---{NL}{body}" for name, body in state["pages"].items()
    ) or "(none yet)"
    user = (
        f"SCHEMA:{NL}{state['schema']}{NL}{NL}"
        f"CURRENT index.md:{NL}{state['index']}{NL}{NL}"
        f"EXISTING PAGES ({len(state['pages'])}):{NL}{existing}{NL}{NL}"
        f"NEW SOURCE{NL}- id: {source_id}{NL}- kind: {kind}{NL}- content:{NL}{content}{NL}"
    )
    resp = llm(
        [{"role": "system", "content": INGEST_SYS},
         {"role": "user", "content": user}],
        max_tokens=32000,
        json_mode=True,
    )
    try:
        plan = extract_json(resp)
    except Exception:
        dump = ROOT / "last_response.txt"
        dump.write_text(resp)
        print(f"--- LLM response unparseable; dumped to {dump} ---")
        print(resp[:1500])
        raise
    for op in plan.get("operations", []):
        if op.get("action") != "write":
            continue
        path = WIKI / op["path"]
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(op["content"])
        print(f"  wrote {path.relative_to(ROOT)}")
    with open(LOG, "a") as f:
        f.write(
            f"\n## [{datetime.now():%Y-%m-%d %H:%M}] ingest | "
            f"{plan.get('log_entry','(untitled)')}\n- source: {source_id}\n"
        )


def cmd_ingest(args):
    ensure_dirs()
    target = args.target
    if target.startswith(("http://", "https://")):
        print(f"fetching {target} …")
        content, src = extract_url(target)
        print(f"fetched {len(content)} chars; compiling …")
        compile_and_apply(src, content, "web")
        return

    path = Path(target).expanduser().resolve()
    if not path.exists():
        sys.exit(f"not found: {path}")

    ext = path.suffix.lower()
    # Copy into raw/ unless already there
    if RAW not in path.parents:
        dest_dir = (RAW / "audio" if ext in AUDIO_EXT
                    else RAW / "video" if ext in VIDEO_EXT
                    else RAW / "images" if ext in IMAGE_EXT
                    else RAW / "documents")
        dest = dest_dir / path.name
        dest.write_bytes(path.read_bytes())
        path = dest
    src = str(path.relative_to(ROOT))

    if ext in TEXT_EXT:
        content, kind = extract_text_file(path), "text"
    elif ext in PDF_EXT:
        print("extracting pdf …")
        content, kind = extract_pdf(path), "pdf"
    elif ext in AUDIO_EXT:
        print("transcribing audio via /stt …")
        content, kind = extract_audio(path), "audio-transcript"
    elif ext in VIDEO_EXT:
        print("analyzing video via yaya.v1 vision …")
        content, kind = analyze_video(path), "video-analysis"
    elif ext in IMAGE_EXT:
        print("analyzing image via yaya.v1 vision …")
        content, kind = analyze_image(path), "image-analysis"
    else:
        sys.exit(f"unknown extension: {ext}")

    print(f"extracted {len(content)} chars; compiling …")
    compile_and_apply(src, content, kind)


# ---------------- Query ----------------
def cmd_query(args):
    ensure_dirs()
    state = read_wiki_state()
    pages_blob = NL.join(
        f"=== {n} ==={NL}{b}" for n, b in state["pages"].items()
    )
    resp = llm([
        {"role": "system", "content":
            "Answer only from the wiki below. Cite supporting pages with "
            "[[slug]] and raw/ paths. If the wiki doesn't cover it, say so."},
        {"role": "user", "content":
            f"WIKI INDEX:{NL}{state['index']}{NL}{NL}"
            f"PAGES:{NL}{pages_blob}{NL}{NL}"
            f"QUESTION: {args.question}"},
    ], max_tokens=4000)
    print(resp)
    if args.speak:
        say(resp)


# ---------------- TTS ----------------
def say(text: str, voice: str = "af_heart"):
    try:
        r = requests.post(f"{AUDIO_URL}/tts",
                          params={"text": text, "voice": voice}, timeout=600)
        r.raise_for_status()
    except requests.RequestException as e:
        print(f"tts failed: {e}")
        return
    out = ROOT / f"tts_{int(time.time())}.wav"
    ctype = r.headers.get("content-type", "")
    if "audio" in ctype or r.content[:4] == b"RIFF":
        out.write_bytes(r.content)
    else:
        try:
            data = r.json()
        except ValueError:
            print("tts: unknown response")
            return
        b64 = data.get("audio") or data.get("samples") or data.get("wav")
        if not b64:
            print("tts response keys:", list(data.keys()))
            return
        out.write_bytes(base64.b64decode(b64))
    print(f"audio → {out}")


def cmd_say(args):
    say(args.text)


# ---------------- Lint ----------------
def cmd_lint(args):
    ensure_dirs()
    state = read_wiki_state()
    pages_blob = NL.join(
        f"=== {n} ==={NL}{b}" for n, b in state["pages"].items()
    )
    resp = llm([
        {"role": "system", "content":
            "You are a wiki linter. Produce a markdown report with sections: "
            "## Contradictions, ## Orphans, ## Stale, ## Gaps. Under each, "
            "list concrete items citing [[slug]] and (when relevant) raw/ paths. "
            "An orphan is a page not referenced by index.md or any other page."},
        {"role": "user", "content":
            f"INDEX:{NL}{state['index']}{NL}{NL}PAGES:{NL}{pages_blob}"},
    ], max_tokens=8000)
    (WIKI / "LINT.md").write_text(
        f"# Lint Report — {datetime.now():%Y-%m-%d %H:%M}\n\n{resp}\n"
    )
    print(resp)


# ---------------- Main ----------------
def main():
    ap = argparse.ArgumentParser(description="Local LLM Wiki")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_i = sub.add_parser("ingest", help="ingest a file or URL")
    p_i.add_argument("target")
    p_i.set_defaults(f=cmd_ingest)

    p_q = sub.add_parser("query", help="ask the wiki")
    p_q.add_argument("question")
    p_q.add_argument("--speak", action="store_true", help="also synthesize audio")
    p_q.set_defaults(f=cmd_query)

    p_l = sub.add_parser("lint", help="health-check the wiki")
    p_l.set_defaults(f=cmd_lint)

    p_s = sub.add_parser("say", help="speak arbitrary text via /tts")
    p_s.add_argument("text")
    p_s.set_defaults(f=cmd_say)

    args = ap.parse_args()
    args.f(args)


if __name__ == "__main__":
    main()
