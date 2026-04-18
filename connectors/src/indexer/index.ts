/**
 * Oficina Data Indexer
 *
 * Pulls DataRecords from all connectors and provides a unified interface
 * for the agentic librarian to search and browse across all business data.
 *
 * This is the READ side of the system — it creates a searchable index
 * of everything: emails, calendar events, files, invoices, customers, etc.
 *
 * The index can be backed by:
 * - In-memory (for small deployments / demo)
 * - PostgreSQL full-text search (for production)
 * - RAGFlow / vector DB (for semantic search with LLMs)
 */

import { Connector, DataRecord, DataKind } from '../types';

export interface IndexerConfig {
  /** How often to re-extract (ms). Default: 5 minutes */
  pollIntervalMs?: number;
  /** Called for each new/updated record — plug in your vector DB here */
  onRecord?: (record: DataRecord) => Promise<void>;
  /** Called when extraction completes */
  onExtractComplete?: (source: string, count: number) => void;
}

export class DataIndexer {
  private connectors: Connector[] = [];
  private records: Map<string, DataRecord> = new Map();
  private lastExtract: Map<string, Date> = new Map();
  private config: IndexerConfig;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(config: IndexerConfig = {}) {
    this.config = config;
  }

  /** Register a connector to extract data from */
  addConnector(connector: Connector): void {
    this.connectors.push(connector);
  }

  /** Run a full extraction from all connectors */
  async extractAll(): Promise<DataRecord[]> {
    const allRecords: DataRecord[] = [];

    const results = await Promise.allSettled(
      this.connectors.map(async (connector) => {
        const since = this.lastExtract.get(connector.name) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // default: last 30 days
        try {
          const records = await connector.extractSince(since);
          this.lastExtract.set(connector.name, new Date());

          for (const record of records) {
            this.records.set(record.id, record);
            if (this.config.onRecord) await this.config.onRecord(record);
          }

          this.config.onExtractComplete?.(connector.name, records.length);
          return records;
        } catch (err) {
          console.error(`[indexer] ${connector.name} extraction failed:`, err);
          return [];
        }
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') allRecords.push(...result.value);
    }

    return allRecords;
  }

  /** Start periodic extraction */
  startPolling(): void {
    const interval = this.config.pollIntervalMs || 5 * 60 * 1000;
    this.timer = setInterval(() => this.extractAll(), interval);
    // Run immediately
    this.extractAll();
  }

  /** Stop periodic extraction */
  stopPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Search across all indexed records */
  search(query: string, filters?: { kind?: DataKind; source?: string; since?: Date; limit?: number }): DataRecord[] {
    const q = query.toLowerCase();
    const limit = filters?.limit || 20;
    const results: DataRecord[] = [];

    for (const record of this.records.values()) {
      if (filters?.kind && record.kind !== filters.kind) continue;
      if (filters?.source && record.source !== filters.source) continue;
      if (filters?.since && record.timestamp < filters.since) continue;

      const searchable = `${record.title} ${record.body} ${record.participants.join(' ')} ${record.tags.join(' ')}`.toLowerCase();
      if (searchable.includes(q)) {
        results.push(record);
        if (results.length >= limit) break;
      }
    }

    return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /** Get all records of a specific kind */
  getByKind(kind: DataKind, limit = 50): DataRecord[] {
    return [...this.records.values()]
      .filter(r => r.kind === kind)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /** Get all records from a specific source */
  getBySource(source: string, limit = 50): DataRecord[] {
    return [...this.records.values()]
      .filter(r => r.source === source)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /** Get a record by its global ID */
  getById(id: string): DataRecord | undefined {
    return this.records.get(id);
  }

  /** Get stats about the index */
  stats(): { total: number; byKind: Record<string, number>; bySource: Record<string, number> } {
    const byKind: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    for (const record of this.records.values()) {
      byKind[record.kind] = (byKind[record.kind] || 0) + 1;
      bySource[record.source] = (bySource[record.source] || 0) + 1;
    }

    return { total: this.records.size, byKind, bySource };
  }

  /** Export all records (for vector DB ingestion, backup, etc.) */
  exportAll(): DataRecord[] {
    return [...this.records.values()];
  }
}
