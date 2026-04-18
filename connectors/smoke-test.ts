/**
 * Smoke test — runs against the live Oficina stack on ssh2.
 * Tests READ (data extraction) and WRITE (action) interfaces.
 * Pass credentials via env vars.
 */

import { createOficina } from './src/index.js';

const ERP_KEY = process.env.ERP_KEY || '';
const ERP_SECRET = process.env.ERP_SECRET || '';
const NC_PASS = process.env.NC_PASS || 'admin';
const STALWART_PASS = process.env.STALWART_PASS || 'admin';
const N8N_KEY = process.env.N8N_KEY || '';

async function main() {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║  Oficina Connectors — Live Smoke Test         ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  const oficina = createOficina({
    erpnext: {
      baseUrl: 'http://localhost:8080',
      apiKey: ERP_KEY,
      apiSecret: ERP_SECRET,
      siteName: 'erp.oficina.local',
    },
    nextcloud: { baseUrl: 'http://localhost:8081', username: 'admin', password: NC_PASS },
    stalwart: { baseUrl: 'http://localhost:8082', username: 'admin', password: STALWART_PASS },
    n8n: { baseUrl: 'http://localhost:5678', apiKey: N8N_KEY },
  });

  let pass = 0;
  let fail = 0;

  function check(name: string, ok: boolean) {
    if (ok) { pass++; console.log(`  ✓ ${name}`); }
    else { fail++; console.log(`  ✗ ${name}`); }
  }

  // 1. Health checks
  console.log('=== Health Checks ===');
  const health = await oficina.healthCheckAll();
  for (const [svc, ok] of Object.entries(health)) check(`${svc} health`, ok);

  // 2. ERPNext
  console.log('\n=== ERPNext ===');
  try {
    const customers = await oficina.erpnext.actions.listCustomers(undefined, 5);
    check(`listCustomers (${customers.length} found)`, true);
  } catch (e: any) {
    check(`listCustomers: ${e.message.slice(0, 80)}`, false);
  }
  try {
    const items = await oficina.erpnext.actions.listItems(undefined, 5);
    check(`listItems (${items.length} found)`, true);
  } catch (e: any) {
    check(`listItems: ${e.message.slice(0, 80)}`, false);
  }

  // 3. Nextcloud
  console.log('\n=== Nextcloud ===');
  try {
    const files = await oficina.nextcloud.actions.listFiles('/');
    check(`listFiles (${files.length} items)`, files.length > 0);
    for (const f of files.slice(0, 3)) console.log(`    ${f.name} (${f.type})`);
  } catch (e: any) { check(`listFiles: ${e.message.slice(0, 80)}`, false); }
  try {
    const events = await oficina.nextcloud.actions.getCalendarEvents();
    check(`getCalendarEvents (${events.length} chars of iCal)`, true);
  } catch (e: any) { check(`getCalendarEvents: ${e.message.slice(0, 80)}`, false); }

  // 4. Stalwart
  console.log('\n=== Stalwart Mail ===');
  try {
    const mailboxes = await oficina.mail.actions.listMailboxes();
    check(`listMailboxes (${mailboxes.length} boxes)`, mailboxes.length > 0);
    for (const m of mailboxes) console.log(`    ${m.name}: ${m.totalEmails} emails`);
  } catch (e: any) { check(`listMailboxes: ${e.message.slice(0, 80)}`, false); }
  try {
    const inbox = await oficina.mail.actions.getInbox(5);
    check(`getInbox (${inbox.length} emails)`, true);
  } catch (e: any) { check(`getInbox: ${e.message.slice(0, 80)}`, false); }

  // 5. n8n
  console.log('\n=== n8n ===');
  try {
    const workflows = await oficina.n8n.actions.listWorkflows();
    check(`listWorkflows (${workflows.length} workflows)`, true);
  } catch (e: any) { check(`listWorkflows: ${e.message.slice(0, 80)}`, false); }

  // 6. Full extraction + search
  console.log('\n=== Data Indexer ===');
  try {
    const result = await oficina.extractAll();
    check(`extractAll (${result.total} records)`, result.total > 0);
    for (const [src, cnt] of Object.entries(result.bySource)) {
      console.log(`    ${src}: ${cnt} records`);
    }
    const stats = oficina.indexer.stats();
    console.log('  By kind:');
    for (const [kind, cnt] of Object.entries(stats.byKind)) {
      console.log(`    ${kind}: ${cnt}`);
    }

    const searchResults = oficina.indexer.search('Nextcloud');
    check(`search("Nextcloud") → ${searchResults.length} results`, searchResults.length > 0);
  } catch (e: any) { check(`extractAll: ${e.message.slice(0, 80)}`, false); }

  // Summary
  console.log(`\n${'═'.repeat(48)}`);
  console.log(`  Results: ${pass} passed, ${fail} failed`);
  console.log(`${'═'.repeat(48)}`);

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(console.error);
