/**
 * n8n Connector
 *
 * Wraps n8n REST API for agentic workflow management.
 * Docs: https://docs.n8n.io/api/
 *
 * READ:  list workflows, execution history, execution output
 * WRITE: trigger workflow via webhook, activate/deactivate, create workflow
 */

import { Connector, DataRecord, HttpClientConfig, httpJson } from '../types';

export interface N8nConfig {
  baseUrl: string; // e.g. "http://n8n:5678"
  apiKey?: string;
}

function makeHttp(config: N8nConfig): HttpClientConfig {
  const headers: Record<string, string> = {};
  if (config.apiKey) headers['X-N8N-API-KEY'] = config.apiKey;
  return { baseUrl: config.baseUrl, headers, timeout: 15000 };
}

// ─── Actions interface ───────────────────────────────────────

export interface N8nActions {
  // ── Read ──
  listWorkflows(): Promise<Array<{ id: string; name: string; active: boolean; updatedAt: string; tags: string[] }>>;
  getWorkflow(id: string): Promise<any>;
  listExecutions(workflowId?: string, limit?: number): Promise<Array<{ id: string; workflowId: string; status: string; startedAt: string; stoppedAt: string }>>;
  getExecution(id: string): Promise<any>;

  // ── Write ──
  triggerWebhook(webhookPath: string, data?: Record<string, unknown>): Promise<any>;
  activateWorkflow(id: string): Promise<void>;
  deactivateWorkflow(id: string): Promise<void>;
}

// ─── Connector implementation ────────────────────────────────

export function createN8nConnector(config: N8nConfig): Connector<N8nActions> {
  const http = makeHttp(config);

  const actions: N8nActions = {
    async listWorkflows() {
      const resp = await httpJson<{ data: any[] }>(http, 'GET', '/api/v1/workflows');
      return (resp.data || []).map(w => ({
        id: w.id,
        name: w.name,
        active: w.active,
        updatedAt: w.updatedAt,
        tags: (w.tags || []).map((t: any) => t.name || t),
      }));
    },

    async getWorkflow(id) {
      const resp = await httpJson<{ data: any }>(http, 'GET', `/api/v1/workflows/${id}`);
      return resp.data;
    },

    async listExecutions(workflowId, limit = 20) {
      const params = new URLSearchParams({ limit: String(limit) });
      if (workflowId) params.set('workflowId', workflowId);
      const resp = await httpJson<{ data: any[] }>(http, 'GET', `/api/v1/executions?${params}`);
      return (resp.data || []).map(e => ({
        id: e.id,
        workflowId: e.workflowId,
        status: e.status,
        startedAt: e.startedAt,
        stoppedAt: e.stoppedAt,
      }));
    },

    async getExecution(id) {
      const resp = await httpJson<{ data: any }>(http, 'GET', `/api/v1/executions/${id}`);
      return resp.data;
    },

    async triggerWebhook(webhookPath, data) {
      return httpJson(http, 'POST', `/webhook/${webhookPath}`, data || {});
    },

    async activateWorkflow(id) {
      await httpJson(http, 'PATCH', `/api/v1/workflows/${id}`, { active: true });
    },

    async deactivateWorkflow(id) {
      await httpJson(http, 'PATCH', `/api/v1/workflows/${id}`, { active: false });
    },
  };

  return {
    name: 'n8n',

    async healthCheck() {
      try {
        await httpJson(http, 'GET', '/healthz');
        return true;
      } catch { return false; }
    },

    async extractSince(since) {
      const records: DataRecord[] = [];
      const now = new Date();

      try {
        const workflows = await actions.listWorkflows();
        for (const w of workflows) {
          if (new Date(w.updatedAt) < since) continue;
          records.push({
            id: `n8n:workflow:${w.id}`,
            source: 'n8n', kind: 'task',
            title: `Workflow: ${w.name}`,
            body: `n8n workflow "${w.name}". Active: ${w.active}. Tags: ${w.tags.join(', ') || 'none'}.`,
            timestamp: new Date(w.updatedAt),
            indexed_at: now,
            metadata: w,
            participants: [],
            tags: ['workflow', ...w.tags, w.active ? 'active' : 'inactive'],
            source_url: `${config.baseUrl}/workflow/${w.id}`,
          });
        }
      } catch { /* n8n may not have API key configured */ }

      return records;
    },

    actions,
  };
}
