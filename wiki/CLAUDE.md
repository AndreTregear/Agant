# CLAUDE.md — Wiki Schema

LLM-compiled knowledge base following Andrej Karpathy's llm-wiki pattern.
Endpoints: yaya.v1 (brain, 1M ctx, multimodal) + localhost:8082 (stt/tts/embed).

## Layout
- `raw/`            immutable originals (never edit)
  - `raw/audio/`    .wav .mp3 .m4a — transcribed via /stt
  - `raw/video/`    .mp4 .avi .mov — analyzed by yaya.v1 vision
  - `raw/images/`   .png .jpg .webp — analyzed by yaya.v1 vision
  - `raw/documents/` .txt .md .pdf
  - `raw/web/`      cached HTML from URL ingests
- `wiki/index.md`   category catalog (LLM-maintained)
- `wiki/log.md`     append-only ingestion log
- `wiki/pages/`     one markdown page per entity/topic (slug.md)
- `wiki/LINT.md`    last lint report
- `CLAUDE.md`       this schema

## Page conventions
- Header: `# <Title>`
- First section: `**Sources:**` — list of `raw/...` paths or URLs
- Body: encyclopedia style, short sections, plain prose
- Backlinks: `[[page-slug]]` to other pages
- Slugs: lowercase-kebab, stable, topic-oriented (not source-filename-oriented)

## Operations
- **ingest** — read a new source; create/update entity pages; update index; append log
- **query** — answer from wiki; cite `[[slug]]` and `raw/` paths
- **lint** — scan for contradictions, orphans, stale claims, data gaps

## Log format
```
## [YYYY-MM-DD HH:MM] ingest | <one-line title>
- source: <raw/path or url>
```
