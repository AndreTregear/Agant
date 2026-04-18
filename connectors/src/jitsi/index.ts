/**
 * Jitsi Meet Connector
 *
 * Wraps Jitsi's REST APIs + Nextcloud recording storage.
 * Jibri saves recordings to Nextcloud via finalize.sh.
 * This connector reads them back and provides meeting management.
 *
 * READ:  active conferences, participants, recordings (from Nextcloud)
 * WRITE: create room link, kick participant (via XMPP/API)
 */

import { Connector, DataRecord, HttpClientConfig, httpJson, httpText } from '../types';

export interface JitsiConfig {
  /** Jitsi web URL, e.g. "http://jitsi-web" or "https://meet.oficina.local" */
  baseUrl: string;
  /** Nextcloud config for reading recordings */
  nextcloudUrl: string;
  nextcloudUser: string;
  nextcloudPassword: string;
  /** Domain used in room URLs */
  domain?: string;
}

function makeHttp(baseUrl: string, headers?: Record<string, string>): HttpClientConfig {
  return { baseUrl, headers, timeout: 15000 };
}

function makeNcAuth(config: JitsiConfig): Record<string, string> {
  const auth = Buffer.from(`${config.nextcloudUser}:${config.nextcloudPassword}`).toString('base64');
  return { Authorization: `Basic ${auth}` };
}

// ─── Minimal XML parser for WebDAV listing ───
function extractFiles(xml: string): Array<{ href: string; name: string; size: string; modified: string; type: string }> {
  const entries: Array<{ href: string; name: string; size: string; modified: string; type: string }> = [];
  const responseRegex = /<d:response>([\s\S]*?)<\/d:response>/g;
  let match;
  while ((match = responseRegex.exec(xml)) !== null) {
    const block = match[1];
    const href = block.match(/<d:href>(.*?)<\/d:href>/)?.[1] || '';
    const name = block.match(/<d:displayname>(.*?)<\/d:displayname>/)?.[1] || href.split('/').filter(Boolean).pop() || '';
    const type = block.match(/<d:getcontenttype>(.*?)<\/d:getcontenttype>/)?.[1] || (block.includes('<d:collection/>') ? 'directory' : 'unknown');
    const size = block.match(/<d:getcontentlength>(.*?)<\/d:getcontentlength>/)?.[1] || '0';
    const modified = block.match(/<d:getlastmodified>(.*?)<\/d:getlastmodified>/)?.[1] || '';
    entries.push({ href, name, size, modified, type });
  }
  return entries;
}

// ─── Actions interface ───────────────────────

export interface JitsiActions {
  // ── Read ──
  /** Generate a meeting room URL */
  createRoomLink(roomName?: string): string;

  /** List recordings stored in Nextcloud /Recordings/ folder */
  listRecordings(): Promise<Array<{ name: string; path: string; size: string; date: string; downloadUrl: string }>>;

  /** Get conference info from Jicofo (if available) */
  getConferenceInfo(): Promise<any>;
}

// ─── Connector implementation ────────────────

export function createJitsiConnector(config: JitsiConfig): Connector<JitsiActions> {
  const http = makeHttp(config.baseUrl);
  const ncHeaders = makeNcAuth(config);
  const ncHttp = makeHttp(config.nextcloudUrl, ncHeaders);
  const domain = config.domain || 'meet.oficina.local';

  const actions: JitsiActions = {
    createRoomLink(roomName) {
      const name = roomName || `meeting-${Date.now().toString(36)}`;
      const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
      return `https://${domain}/${slug}`;
    },

    async listRecordings() {
      try {
      const xml = await httpText(ncHttp, 'PROPFIND',
        `/remote.php/dav/files/${encodeURIComponent(config.nextcloudUser)}/Recordings/`,
        `<?xml version="1.0"?>
        <d:propfind xmlns:d="DAV:">
          <d:prop>
            <d:displayname/><d:getcontenttype/><d:getlastmodified/><d:getcontentlength/>
          </d:prop>
        </d:propfind>`,
        { ...ncHeaders, Depth: 'infinity', 'Content-Type': 'application/xml' },
      );
      const files = extractFiles(xml).filter(f => f.type !== 'directory' && (f.name.endsWith('.mp4') || f.name.endsWith('.mkv')));
      return files.map(f => ({
        name: f.name,
        path: f.href,
        size: f.size,
        date: f.modified,
        downloadUrl: `${config.nextcloudUrl}${f.href}`,
      }));
      } catch {
        // Recordings folder doesn't exist yet — no recordings made
        return [];
      }
    },

    async getConferenceInfo() {
      try {
        return await httpJson(http, 'GET', '/about/health');
      } catch {
        return { status: 'unavailable' };
      }
    },
  };

  return {
    name: 'jitsi',

    async healthCheck() {
      try {
        // Jitsi web serves a page at root
        await httpText(http, 'GET', '/');
        return true;
      } catch { return false; }
    },

    async extractSince(since) {
      const records: DataRecord[] = [];
      const now = new Date();

      // Extract recordings from Nextcloud
      try {
        const recordings = await actions.listRecordings();
        for (const rec of recordings) {
          const modified = new Date(rec.date);
          if (modified < since) continue;
          records.push({
            id: `jitsi:meeting_recording:${rec.name}`,
            source: 'nextcloud', // stored in Nextcloud
            kind: 'meeting_recording',
            title: `Meeting Recording: ${rec.name}`,
            body: `Video recording from Jitsi meeting. File: ${rec.name}. Size: ${(parseInt(rec.size) / 1024 / 1024).toFixed(1)}MB. Date: ${rec.date}.`,
            timestamp: modified,
            indexed_at: now,
            metadata: rec,
            participants: [], // could parse from filename if convention used
            tags: ['recording', 'meeting', 'video'],
            source_url: rec.downloadUrl,
          });
        }
      } catch {
        // Recordings folder may not exist yet
      }

      return records;
    },

    actions,
  };
}
