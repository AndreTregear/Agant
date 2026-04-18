/**
 * Nextcloud Connector
 *
 * Wraps OCS API (users, shares, apps) + WebDAV (files) + CalDAV (calendar/contacts).
 * Docs: https://docs.nextcloud.com/server/latest/developer_manual/client_apis/
 *
 * READ:  files, calendar events, contacts, shares, activity
 * WRITE: upload file, create event, share file, create folder, delete
 */

import { Connector, DataRecord, HttpClientConfig, httpJson, httpText } from '../types';

export interface NextcloudConfig {
  baseUrl: string; // e.g. "http://nextcloud"
  username: string;
  password: string;
}

function makeHttp(config: NextcloudConfig): HttpClientConfig {
  const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
  return {
    baseUrl: config.baseUrl,
    headers: { Authorization: `Basic ${auth}`, 'OCS-APIRequest': 'true' },
    timeout: 15000,
  };
}

// ─── OCS + WebDAV helpers ────────────────────────────────────

interface OCSResponse<T> {
  ocs: { meta: { status: string; statuscode: number }; data: T };
}

async function ocsGet<T>(http: HttpClientConfig, path: string): Promise<T> {
  const resp = await httpJson<OCSResponse<T>>(http, 'GET', `/ocs/v2.php/apps/${path}?format=json`);
  return resp.ocs.data;
}

async function webdavPropfind(http: HttpClientConfig, path: string, depth = 1): Promise<string> {
  return httpText(http, 'PROPFIND', `/remote.php/dav/${path}`,
    `<?xml version="1.0"?>
    <d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns" xmlns:nc="http://nextcloud.org/ns">
      <d:prop>
        <d:displayname/><d:getcontenttype/><d:getlastmodified/>
        <d:getcontentlength/><oc:fileid/><oc:size/><d:resourcetype/>
      </d:prop>
    </d:propfind>`,
    { Depth: String(depth), 'Content-Type': 'application/xml' },
  );
}

// Minimal XML parser — pull values from WebDAV PROPFIND responses
function extractPropfindEntries(xml: string): Array<{ href: string; name: string; type: string; size: string; modified: string }> {
  const entries: Array<{ href: string; name: string; type: string; size: string; modified: string }> = [];
  const responseRegex = /<d:response>([\s\S]*?)<\/d:response>/g;
  let match;
  while ((match = responseRegex.exec(xml)) !== null) {
    const block = match[1];
    const href = block.match(/<d:href>(.*?)<\/d:href>/)?.[1] || '';
    const name = block.match(/<d:displayname>(.*?)<\/d:displayname>/)?.[1] || href.split('/').filter(Boolean).pop() || '';
    const type = block.match(/<d:getcontenttype>(.*?)<\/d:getcontenttype>/)?.[1] || (block.includes('<d:collection/>') ? 'directory' : 'unknown');
    const size = block.match(/<(?:d:getcontentlength|oc:size)>(.*?)<\/(?:d:getcontentlength|oc:size)>/)?.[1] || '0';
    const modified = block.match(/<d:getlastmodified>(.*?)<\/d:getlastmodified>/)?.[1] || '';
    entries.push({ href, name, type, size, modified });
  }
  return entries;
}

// ─── Actions interface ───────────────────────────────────────

export interface NextcloudActions {
  // ── Read ──
  listFiles(path?: string): Promise<Array<{ href: string; name: string; type: string; size: string; modified: string }>>;
  searchFiles(query: string): Promise<any>;
  getCalendarEvents(calendarName?: string): Promise<string>;
  listShares(): Promise<any[]>;
  getActivity(limit?: number): Promise<any[]>;

  // ── Write ──
  uploadFile(path: string, content: Buffer | string, contentType?: string): Promise<void>;
  createFolder(path: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  shareFile(path: string, shareWith: string, shareType?: number): Promise<any>;
  createCalendarEvent(calendarName: string, ical: string): Promise<void>;
}

// ─── Connector implementation ────────────────────────────────

export function createNextcloudConnector(config: NextcloudConfig): Connector<NextcloudActions> {
  const http = makeHttp(config);

  const actions: NextcloudActions = {
    async listFiles(path = '/') {
      const xml = await webdavPropfind(http, `files/${config.username}${path}`);
      const entries = extractPropfindEntries(xml);
      return entries.slice(1); // first entry is the folder itself
    },

    async searchFiles(query) {
      // Use WebDAV SEARCH
      const xml = await httpText(http, 'SEARCH', `/remote.php/dav/`,
        `<?xml version="1.0"?>
        <d:searchrequest xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
          <d:basicsearch>
            <d:select><d:prop><d:displayname/><d:getcontenttype/><d:getlastmodified/><oc:fileid/></d:prop></d:select>
            <d:from><d:scope><d:href>/files/${config.username}</d:href><d:depth>infinity</d:depth></d:scope></d:from>
            <d:where><d:like><d:prop><d:displayname/></d:prop><d:literal>%${query}%</d:literal></d:like></d:where>
            <d:limit><d:nresults>50</d:nresults></d:limit>
          </d:basicsearch>
        </d:searchrequest>`,
        { 'Content-Type': 'application/xml' },
      );
      return extractPropfindEntries(xml);
    },

    async getCalendarEvents(calendarName = 'personal') {
      // CalDAV REPORT for events in the next 30 days
      const now = new Date();
      const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      return httpText(http, 'REPORT',
        `/remote.php/dav/calendars/${config.username}/${calendarName}`,
        `<?xml version="1.0"?>
        <c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
          <d:prop><d:getetag/><c:calendar-data/></d:prop>
          <c:filter>
            <c:comp-filter name="VCALENDAR">
              <c:comp-filter name="VEVENT">
                <c:time-range start="${now.toISOString().replace(/[-:]/g, '').split('.')[0]}Z"
                              end="${future.toISOString().replace(/[-:]/g, '').split('.')[0]}Z"/>
              </c:comp-filter>
            </c:comp-filter>
          </c:filter>
        </c:calendar-query>`,
        { 'Content-Type': 'application/xml', Depth: '1' },
      );
    },

    async listShares() {
      return ocsGet<any[]>(http, 'files_sharing/api/v1/shares');
    },

    async getActivity(limit = 50) {
      const resp = await httpJson<OCSResponse<any[]>>(http, 'GET',
        `/ocs/v2.php/apps/activity/api/v2/activity?format=json&limit=${limit}`);
      return resp.ocs.data;
    },

    // ── Write ──
    async uploadFile(path, content, contentType = 'application/octet-stream') {
      const fullPath = `/remote.php/dav/files/${config.username}${path}`;
      await httpText(
        http, 'PUT', fullPath,
        typeof content === 'string' ? content : content.toString('base64'),
        { 'Content-Type': contentType },
      );
    },

    async createFolder(path) {
      await httpText(http, 'MKCOL', `/remote.php/dav/files/${config.username}${path}`, undefined);
    },

    async deleteFile(path) {
      await httpText(http, 'DELETE', `/remote.php/dav/files/${config.username}${path}`, undefined);
    },

    async shareFile(path, shareWith, shareType = 0) {
      // shareType: 0=user, 1=group, 3=public link
      await httpJson(http, 'POST', '/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json', {
        path, shareWith, shareType, permissions: 1, // read
      });
    },

    async createCalendarEvent(calendarName, ical) {
      const uid = crypto.randomUUID();
      await httpText(http, 'PUT',
        `/remote.php/dav/calendars/${config.username}/${calendarName}/${uid}.ics`,
        ical,
        { 'Content-Type': 'text/calendar' },
      );
    },
  };

  return {
    name: 'nextcloud',

    async healthCheck() {
      try {
        await httpJson(http, 'GET', '/ocs/v2.php/cloud/capabilities?format=json');
        return true;
      } catch { return false; }
    },

    async extractSince(since) {
      const records: DataRecord[] = [];
      const now = new Date();

      // Extract files
      try {
        const files = await actions.listFiles('/');
        for (const f of files) {
          if (f.type === 'directory') continue;
          const modified = new Date(f.modified);
          if (modified < since) continue;
          records.push({
            id: `nextcloud:file:${f.href}`,
            source: 'nextcloud', kind: 'file',
            title: f.name,
            body: `File: ${f.name}. Type: ${f.type}. Size: ${f.size} bytes. Path: ${f.href}`,
            timestamp: modified,
            indexed_at: now,
            metadata: f,
            participants: [],
            tags: [f.type],
            source_url: `${config.baseUrl}/apps/files/?dir=${f.href.split('/').slice(0, -1).join('/')}`,
          });
        }
      } catch { /* files may not be accessible */ }

      // Extract calendar events
      try {
        const icalData = await actions.getCalendarEvents();
        const eventBlocks = icalData.split('BEGIN:VEVENT');
        for (const block of eventBlocks.slice(1)) {
          const summary = block.match(/SUMMARY:(.*)/)?.[1]?.trim() || 'Untitled';
          const dtstart = block.match(/DTSTART[^:]*:(.*)/)?.[1]?.trim() || '';
          const dtend = block.match(/DTEND[^:]*:(.*)/)?.[1]?.trim() || '';
          const description = block.match(/DESCRIPTION:(.*)/)?.[1]?.trim() || '';
          const uid = block.match(/UID:(.*)/)?.[1]?.trim() || '';
          const attendees = [...block.matchAll(/ATTENDEE[^:]*:(.*)/g)].map(m => m[1].trim());

          records.push({
            id: `nextcloud:calendar_event:${uid}`,
            source: 'nextcloud', kind: 'calendar_event',
            title: summary,
            body: `Calendar event: ${summary}. Start: ${dtstart}. End: ${dtend}. ${description}`,
            timestamp: dtstart ? new Date(dtstart.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6')) : now,
            indexed_at: now,
            metadata: { summary, dtstart, dtend, description, uid },
            participants: attendees,
            tags: ['calendar'],
            source_url: `${config.baseUrl}/apps/calendar/`,
          });
        }
      } catch { /* calendar may not exist */ }

      return records;
    },

    actions,
  };
}
