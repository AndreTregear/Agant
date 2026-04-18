/**
 * Oficina Connectors — Main Entry Point
 *
 * Creates all connectors from environment variables and provides
 * a unified interface for any AI agent framework to use.
 *
 * Usage:
 *   import { createOficina } from '@oficina/connectors'
 *   const oficina = createOficina()
 *   await oficina.erpnext.actions.listCustomers("Garcia")
 *   await oficina.mail.actions.sendEmail({ to: "...", subject: "...", textBody: "..." })
 *   await oficina.indexer.search("facturas pendientes")
 */

export { type DataRecord, type DataKind, type Connector } from './types';
export { createERPNextConnector, type ERPNextActions, type ERPNextConfig } from './erpnext';
export { createNextcloudConnector, type NextcloudActions, type NextcloudConfig } from './nextcloud';
export { createStalwartConnector, type StalwartActions, type StalwartConfig } from './stalwart';
export { createN8nConnector, type N8nActions, type N8nConfig } from './n8n';
export { DataIndexer, type IndexerConfig } from './indexer';

import { createERPNextConnector } from './erpnext';
import { createNextcloudConnector } from './nextcloud';
import { createStalwartConnector } from './stalwart';
import { createN8nConnector } from './n8n';
import { DataIndexer } from './indexer';
import type { Connector, ERPNextActions, NextcloudActions, StalwartActions, N8nActions } from './index';

export interface Oficina {
  erpnext: Connector<ERPNextActions>;
  nextcloud: Connector<NextcloudActions>;
  mail: Connector<StalwartActions>;
  n8n: Connector<N8nActions>;
  indexer: DataIndexer;

  /** Health check all services */
  healthCheckAll(): Promise<Record<string, boolean>>;

  /** Run a full data extraction across all services */
  extractAll(): Promise<{ total: number; bySource: Record<string, number> }>;
}

export interface OficinaConfig {
  erpnext?: { baseUrl: string; apiKey?: string; apiSecret?: string; siteName?: string };
  nextcloud?: { baseUrl: string; username: string; password: string };
  stalwart?: { baseUrl: string; username: string; password: string };
  n8n?: { baseUrl: string; apiKey?: string };
  indexer?: { pollIntervalMs?: number; onRecord?: (record: any) => Promise<void> };
}

/**
 * Create the Oficina connector suite.
 * Reads config from the argument or falls back to environment variables.
 */
export function createOficina(config?: OficinaConfig): Oficina {
  const erpnext = createERPNextConnector(config?.erpnext || {
    baseUrl: process.env.ERPNEXT_URL || 'http://erpnext:8000',
    apiKey: process.env.ERPNEXT_API_KEY,
    apiSecret: process.env.ERPNEXT_API_SECRET,
    siteName: process.env.ERPNEXT_SITE || 'erp.oficina.local',
  });

  const nextcloud = createNextcloudConnector(config?.nextcloud || {
    baseUrl: process.env.NEXTCLOUD_URL || 'http://nextcloud',
    username: process.env.NEXTCLOUD_USER || 'admin',
    password: process.env.NEXTCLOUD_PASSWORD || '',
  });

  const mail = createStalwartConnector(config?.stalwart || {
    baseUrl: process.env.STALWART_URL || 'http://stalwart:8080',
    username: process.env.STALWART_USER || 'admin',
    password: process.env.STALWART_PASSWORD || '',
  });

  const n8n = createN8nConnector(config?.n8n || {
    baseUrl: process.env.N8N_URL || 'http://n8n:5678',
    apiKey: process.env.N8N_API_KEY,
  });

  const indexer = new DataIndexer(config?.indexer);
  indexer.addConnector(erpnext);
  indexer.addConnector(nextcloud);
  indexer.addConnector(mail);
  indexer.addConnector(n8n);

  return {
    erpnext,
    nextcloud,
    mail,
    n8n,
    indexer,

    async healthCheckAll() {
      const [erp, nc, st, n8] = await Promise.allSettled([
        erpnext.healthCheck(),
        nextcloud.healthCheck(),
        mail.healthCheck(),
        n8n.healthCheck(),
      ]);
      return {
        erpnext: erp.status === 'fulfilled' && erp.value,
        nextcloud: nc.status === 'fulfilled' && nc.value,
        stalwart: st.status === 'fulfilled' && st.value,
        n8n: n8.status === 'fulfilled' && n8.value,
      };
    },

    async extractAll() {
      const records = await indexer.extractAll();
      const stats = indexer.stats();
      return { total: records.length, bySource: stats.bySource };
    },
  };
}
