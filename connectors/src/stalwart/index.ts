/**
 * Stalwart Mail Connector
 *
 * Wraps JMAP (RFC 8620/8621) for agentic email access.
 * Stalwart serves JMAP at /jmap endpoint.
 *
 * READ:  inbox, search emails, get email content, list mailboxes
 * WRITE: send email, move to folder, flag/unflag, create mailbox
 */

import { Connector, DataRecord, HttpClientConfig, httpJson, httpText } from '../types';

export interface StalwartConfig {
  baseUrl: string; // e.g. "http://stalwart:8080"
  username: string;
  password: string;
}

function makeHttp(config: StalwartConfig): HttpClientConfig {
  const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
  return {
    baseUrl: config.baseUrl,
    headers: { Authorization: `Basic ${auth}` },
    timeout: 15000,
  };
}

// ─── JMAP helpers ────────────────────────────────────────────

interface JMAPResponse {
  methodResponses: [string, any, string][];
  sessionState: string;
}

async function jmapCall(http: HttpClientConfig, methodCalls: [string, Record<string, unknown>, string][]): Promise<JMAPResponse> {
  return httpJson<JMAPResponse>(http, 'POST', '/jmap', {
    using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail', 'urn:ietf:params:jmap:submission'],
    methodCalls,
  });
}

function getResult(resp: JMAPResponse, callId: string): any {
  const found = resp.methodResponses.find(r => r[2] === callId);
  return found ? found[1] : null;
}

// ─── Actions interface ───────────────────────────────────────

export interface StalwartActions {
  // ── Read ──
  listMailboxes(): Promise<Array<{ id: string; name: string; totalEmails: number; unreadEmails: number }>>;
  getInbox(limit?: number): Promise<Array<{ id: string; subject: string; from: string; date: string; preview: string; isUnread: boolean }>>;
  searchEmails(query: string, limit?: number): Promise<Array<{ id: string; subject: string; from: string; date: string; preview: string }>>;
  getEmail(emailId: string): Promise<{ id: string; subject: string; from: any; to: any; date: string; textBody: string; htmlBody: string }>;

  // ── Write ──
  sendEmail(data: { to: string; subject: string; textBody: string; htmlBody?: string; from?: string }): Promise<{ sent: boolean; messageId?: string }>;
  moveToFolder(emailId: string, mailboxId: string): Promise<void>;
  flagEmail(emailId: string, flagged: boolean): Promise<void>;
  markRead(emailId: string, read: boolean): Promise<void>;
}

// ─── Connector implementation ────────────────────────────────

export function createStalwartConnector(config: StalwartConfig): Connector<StalwartActions> {
  const http = makeHttp(config);

  // Cache account ID
  let accountId: string | null = null;
  async function getAccountId(): Promise<string> {
    if (accountId) return accountId;
    const session = await httpJson<any>(http, 'GET', '/.well-known/jmap');
    accountId = Object.keys(session.accounts || {})[0] || session.primaryAccounts?.['urn:ietf:params:jmap:mail'] || '';
    return accountId!;
  }

  const actions: StalwartActions = {
    async listMailboxes() {
      const acct = await getAccountId();
      const resp = await jmapCall(http, [
        ['Mailbox/get', { accountId: acct, properties: ['id', 'name', 'totalEmails', 'unreadEmails', 'role'] }, 'mb'],
      ]);
      const result = getResult(resp, 'mb');
      return (result?.list || []).map((m: any) => ({
        id: m.id, name: m.name, totalEmails: m.totalEmails, unreadEmails: m.unreadEmails,
      }));
    },

    async getInbox(limit = 20) {
      const acct = await getAccountId();
      const resp = await jmapCall(http, [
        ['Mailbox/query', { accountId: acct, filter: { role: 'inbox' } }, 'findInbox'],
      ]);
      const inboxId = getResult(resp, 'findInbox')?.ids?.[0];
      if (!inboxId) return [];

      const resp2 = await jmapCall(http, [
        ['Email/query', {
          accountId: acct,
          filter: { inMailbox: inboxId },
          sort: [{ property: 'receivedAt', isAscending: false }],
          limit,
        }, 'q'],
        ['Email/get', {
          accountId: acct,
          '#ids': { resultOf: 'q', name: 'Email/query', path: '/ids' },
          properties: ['id', 'subject', 'from', 'receivedAt', 'preview', 'keywords'],
        }, 'emails'],
      ]);
      const emails = getResult(resp2, 'emails')?.list || [];
      return emails.map((e: any) => ({
        id: e.id,
        subject: e.subject || '(no subject)',
        from: e.from?.[0]?.email || 'unknown',
        date: e.receivedAt,
        preview: e.preview || '',
        isUnread: !e.keywords?.['$seen'],
      }));
    },

    async searchEmails(query, limit = 20) {
      const acct = await getAccountId();
      const resp = await jmapCall(http, [
        ['Email/query', {
          accountId: acct,
          filter: { text: query },
          sort: [{ property: 'receivedAt', isAscending: false }],
          limit,
        }, 'q'],
        ['Email/get', {
          accountId: acct,
          '#ids': { resultOf: 'q', name: 'Email/query', path: '/ids' },
          properties: ['id', 'subject', 'from', 'receivedAt', 'preview'],
        }, 'emails'],
      ]);
      const emails = getResult(resp, 'emails')?.list || [];
      return emails.map((e: any) => ({
        id: e.id,
        subject: e.subject || '(no subject)',
        from: e.from?.[0]?.email || 'unknown',
        date: e.receivedAt,
        preview: e.preview || '',
      }));
    },

    async getEmail(emailId) {
      const acct = await getAccountId();
      const resp = await jmapCall(http, [
        ['Email/get', {
          accountId: acct,
          ids: [emailId],
          properties: ['id', 'subject', 'from', 'to', 'cc', 'receivedAt', 'textBody', 'htmlBody', 'bodyValues'],
          fetchTextBodyValues: true,
          fetchHTMLBodyValues: true,
        }, 'e'],
      ]);
      const e = getResult(resp, 'e')?.list?.[0];
      if (!e) throw new Error(`Email ${emailId} not found`);

      const textParts = (e.textBody || []).map((p: any) => e.bodyValues?.[p.partId]?.value || '').join('\n');
      const htmlParts = (e.htmlBody || []).map((p: any) => e.bodyValues?.[p.partId]?.value || '').join('\n');

      return {
        id: e.id,
        subject: e.subject,
        from: e.from,
        to: e.to,
        date: e.receivedAt,
        textBody: textParts,
        htmlBody: htmlParts,
      };
    },

    async sendEmail(data) {
      const acct = await getAccountId();
      const draftId = `draft-${Date.now()}`;
      const resp = await jmapCall(http, [
        ['Email/set', {
          accountId: acct,
          create: {
            [draftId]: {
              from: [{ email: data.from || config.username }],
              to: [{ email: data.to }],
              subject: data.subject,
              textBody: [{ partId: 'text', type: 'text/plain' }],
              bodyValues: { text: { value: data.textBody } },
              keywords: { $draft: true },
            },
          },
        }, 'draft'],
        ['EmailSubmission/set', {
          accountId: acct,
          create: {
            send: {
              emailId: `#${draftId}`,
              envelope: {
                mailFrom: { email: data.from || config.username },
                rcptTo: [{ email: data.to }],
              },
            },
          },
          onSuccessUpdateEmail: { '#send': { 'keywords/$draft': null, 'mailboxIds/sent': true } },
        }, 'send'],
      ]);
      const sendResult = getResult(resp, 'send');
      return {
        sent: !!sendResult?.created?.send,
        messageId: sendResult?.created?.send?.emailId,
      };
    },

    async moveToFolder(emailId, mailboxId) {
      const acct = await getAccountId();
      await jmapCall(http, [
        ['Email/set', {
          accountId: acct,
          update: { [emailId]: { mailboxIds: { [mailboxId]: true } } },
        }, 'move'],
      ]);
    },

    async flagEmail(emailId, flagged) {
      const acct = await getAccountId();
      await jmapCall(http, [
        ['Email/set', {
          accountId: acct,
          update: { [emailId]: { [`keywords/$flagged`]: flagged || null } },
        }, 'flag'],
      ]);
    },

    async markRead(emailId, read) {
      const acct = await getAccountId();
      await jmapCall(http, [
        ['Email/set', {
          accountId: acct,
          update: { [emailId]: { [`keywords/$seen`]: read || null } },
        }, 'read'],
      ]);
    },
  };

  return {
    name: 'stalwart',

    async healthCheck() {
      try {
        await httpText(http, 'GET', '/health');
        return true;
      } catch { return false; }
    },

    async extractSince(since) {
      const records: DataRecord[] = [];
      const now = new Date();

      try {
        const acct = await getAccountId();
        const sinceStr = since.toISOString();

        const resp = await jmapCall(http, [
          ['Email/query', {
            accountId: acct,
            filter: { after: sinceStr },
            sort: [{ property: 'receivedAt', isAscending: false }],
            limit: 200,
          }, 'q'],
          ['Email/get', {
            accountId: acct,
            '#ids': { resultOf: 'q', name: 'Email/query', path: '/ids' },
            properties: ['id', 'subject', 'from', 'to', 'receivedAt', 'preview'],
          }, 'emails'],
        ]);

        const emails = getResult(resp, 'emails')?.list || [];
        for (const e of emails) {
          const fromAddr = e.from?.[0]?.email || 'unknown';
          const toAddrs = (e.to || []).map((t: any) => t.email);
          records.push({
            id: `stalwart:email:${e.id}`,
            source: 'stalwart', kind: 'email',
            title: e.subject || '(no subject)',
            body: `Email from ${fromAddr}: ${e.subject}. ${e.preview || ''}`,
            timestamp: new Date(e.receivedAt),
            indexed_at: now,
            metadata: { from: fromAddr, to: toAddrs, subject: e.subject },
            participants: [fromAddr, ...toAddrs],
            tags: ['email'],
            source_url: `${config.baseUrl}`,
          });
        }
      } catch { /* mail may not be accessible */ }

      return records;
    },

    actions,
  };
}
