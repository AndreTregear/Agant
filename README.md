# Agant

**The open-source business operating system.** One box. Every tool. Your data.

Agant is a self-hosted business appliance that bundles the best free and open-source software into a single, AI-connected platform. Video meetings, email, CRM, invoicing, file storage, calendars, workflow automation — all running on hardware you own, with an AI agent that can read and act on everything.

No subscriptions. No vendor lock-in. No data leaving your building.

---

## What's Inside

| You need | Agant gives you | Replaces |
|----------|----------------|----------|
| **Video meetings** | Jitsi Meet + Jibri recording | Zoom, Google Meet, Teams |
| **Email** | Stalwart Mail Server | Gmail, Outlook |
| **Files & documents** | Nextcloud | Google Drive, Dropbox, SharePoint |
| **Calendar & contacts** | Nextcloud Calendar/Contacts | Google Calendar, Outlook |
| **CRM & sales** | ERPNext | Salesforce, HubSpot |
| **Invoicing & accounting** | ERPNext | QuickBooks, FreshBooks |
| **Inventory & purchasing** | ERPNext | TradeGecko, Cin7 |
| **HR & payroll** | ERPNext HRMS | BambooHR, Gusto |
| **Workflow automation** | n8n | Zapier, Make |
| **Single sign-on** | Authentik | Okta, Auth0 |
| **AI agent** | @oficina/connectors | (nothing like it exists) |

**Total cost of SaaS this replaces: $200-500/month per user.**
**Cost of Agant: one machine, forever.**

---

## Architecture

```
                        +-----------+
                        |  Browser  |
                        +-----+-----+
                              |
                        +-----v-----+
                        |   Caddy   |  reverse proxy, auto TLS
                        +-----+-----+
                              |
          +---+---+---+---+---+---+---+---+
          |   |   |   |   |   |   |   |   |
        ERP  NC  Mail Meet Auth n8n  ...  AI
         |   |    |    |    |   |        Agent
         +---+----+----+----+---+----------+
                        |
                  +-----v------+
                  | DataIndexer|  unified search across everything
                  +-----+------+
                        |
                  +-----v------+
                  | PostgreSQL |  MariaDB  |  Redis
                  +------------+
```

## Quick Start

```bash
# Clone
git clone https://github.com/AndreTregear/Agant.git
cd Agant

# First boot (generates secrets, configures everything)
bash scripts/setup.sh

# Or start manually
cp .env.template .env
# Edit .env with your settings
docker compose -f docker-compose-lean.yml \
  --profile foundation --profile identity --profile proxy \
  --profile erp --profile nextcloud --profile mail \
  --profile meetings --profile automation \
  up -d
```

## Connector API

The AI integration layer. Every app is accessible through a unified TypeScript interface.

```typescript
import { createOficina } from '@oficina/connectors'

const oficina = createOficina()

// Check what's happening across the entire business
const health = await oficina.healthCheckAll()
// { erpnext: true, nextcloud: true, stalwart: true, n8n: true, jitsi: true }

// Read from any app
const customers = await oficina.erpnext.actions.listCustomers("Garcia")
const inbox     = await oficina.mail.actions.getInbox(10)
const files     = await oficina.nextcloud.actions.listFiles("/Contracts")
const events    = await oficina.nextcloud.actions.getCalendarEvents()

// Act on any app
await oficina.mail.actions.sendEmail({
  to: "client@example.com",
  subject: "Invoice attached",
  textBody: "Please find your invoice attached."
})
await oficina.erpnext.actions.createSalesInvoice({
  customer: "Garcia Corp",
  items: [{ item_code: "CONSULTING", qty: 10, rate: 150 }]
})
await oficina.meetings.actions.createRoomLink("quarterly-review")

// Search across everything
await oficina.extractAll()  // pulls data from all apps
oficina.indexer.search("pending invoices")  // unified search
```

### Connectors

| Connector | Read | Write |
|-----------|------|-------|
| **ERPNext** | customers, invoices, items, stock, employees, leads, account balance | create customer/invoice/order/lead, update, submit |
| **Nextcloud** | files, calendar events, shares, activity | upload, create folder, share, create event |
| **Stalwart** | mailboxes, inbox, search, full email content | send email, move, flag, mark read |
| **Jitsi** | conference info, recordings | create room link |
| **n8n** | workflows, executions | trigger workflow, activate/deactivate |

### DataIndexer

Every piece of data from every app gets normalized into a `DataRecord`:

```typescript
interface DataRecord {
  id: string           // "stalwart:email:abc123"
  source: string       // "erpnext" | "nextcloud" | "stalwart" | "n8n"
  kind: string         // "email" | "calendar_event" | "file" | "invoice" | "customer" | ...
  title: string        // "Invoice INV-2026-001 — Garcia Corp"
  body: string         // full text for search / LLM context
  timestamp: Date
  participants: string[]
  tags: string[]
  source_url: string   // link back to the source app
}
```

This is the interface for any AI agent, RAG system, or search engine to consume.

---

## Compute Footprint

Tested on a 64GB RAM / 8-core machine:

| Metric | Value |
|--------|-------|
| RAM used | 5.1 GB |
| CPU load | 0.1 |
| Containers | 17 |
| Disk | ~20 GB (before data) |

The entire business stack runs in **under 6GB RAM**. The rest is headroom for your AI models.

---

## Standing on the Shoulders of Giants

Agant exists because of these incredible open-source projects. We don't build business software — we connect the best of what already exists and make it accessible to every business on Earth.

### Core Applications

- **[ERPNext](https://github.com/frappe/erpnext)** by Frappe Technologies (GPL v3) — The most comprehensive open-source ERP in the world. CRM, invoicing, inventory, manufacturing, HR, payroll — 100+ modules built by thousands of contributors since 2008. ERPNext proves that enterprise software doesn't need to cost $100K/year.

- **[Frappe Framework](https://github.com/frappe/frappe)** by Frappe Technologies (MIT) — The full-stack web framework that powers ERPNext. Metadata-driven, REST API out of the box, real-time updates. One of the most underrated frameworks in existence.

- **[Nextcloud](https://github.com/nextcloud/server)** by Nextcloud GmbH (AGPL v3) — The Google Workspace killer. Files, calendar, contacts, talk, office suite, and 400+ apps. 25+ million users. Founded by Frank Karlitschek after forking from ownCloud to keep it truly open.

- **[Stalwart Mail Server](https://github.com/stalwartlabs/stalwart)** by Stalwart Labs (AGPL v3) — Written in Rust from scratch. JMAP + IMAP + SMTP + CalDAV + CardDAV in a single binary. The fastest, most modern mail server in the open-source world. What happens when you rethink email infrastructure in 2024.

- **[Jitsi Meet](https://github.com/jitsi/jitsi-meet)** by 8x8 / Jitsi Community (Apache 2.0) — Fully encrypted video conferencing that anyone can self-host. Used by millions. No account needed to join a call. The anti-Zoom.

- **[Jibri](https://github.com/jitsi/jibri)** by 8x8 / Jitsi Community (Apache 2.0) — Jitsi Broadcasting Infrastructure. Records and streams meetings by running a headless Chrome that captures everything. Ingenious approach to a hard problem.

- **[n8n](https://github.com/n8n-io/n8n)** by n8n GmbH (Sustainable Use License) — Visual workflow automation with 400+ integrations and native AI capabilities. The open-source Zapier that developers actually love. Fair-code licensed — free to self-host, source available.

### Infrastructure

- **[Authentik](https://github.com/goauthentik/authentik)** by Authentik Security (MIT) — Modern identity provider with flow-based authentication. Lighter than Keycloak, more beautiful UI, and it just works. OIDC/SAML/LDAP/SCIM — the whole alphabet of auth protocols.

- **[Caddy](https://github.com/caddyserver/caddy)** by Matt Holt & contributors (Apache 2.0) — The web server that made HTTPS automatic. Written in Go, zero-config TLS, native reverse proxy. The best thing to happen to web infrastructure in a decade.

- **[PostgreSQL](https://www.postgresql.org/)** by the PostgreSQL Global Development Group (PostgreSQL License) — The world's most advanced open-source database. 35+ years of rock-solid reliability. If your data matters, it belongs in Postgres.

- **[MariaDB](https://github.com/MariaDB/server)** by MariaDB Foundation (GPL v2) — The community fork of MySQL that kept the spirit alive after Oracle's acquisition. Powers ERPNext's data layer.

- **[Redis](https://github.com/redis/redis)** by Redis Ltd (RSALv2 / SSPLv1) — In-memory data store. Cache, message broker, queue. The silent workhorse behind every fast application.

- **[Docker](https://github.com/moby/moby)** by Docker Inc (Apache 2.0) — Containerization that changed how we deploy software. Agant runs 17 containers orchestrated by Compose. Each app is isolated, updatable, and reproducible.

### Also Available (Full Stack)

These are included in the full `docker-compose.yml` for organizations that need them:

- **[Apache Superset](https://github.com/apache/superset)** (Apache 2.0) — Business intelligence and data visualization. Petabyte-scale analytics.
- **[Rocket.Chat](https://github.com/RocketChat/Rocket.Chat)** (MIT) — Team messaging and collaboration platform.
- **[Zammad](https://github.com/zammad/zammad)** (AGPL v3) — Customer support helpdesk and ticketing.
- **[WordPress](https://github.com/WordPress/WordPress)** + WooCommerce (GPL v2) — CMS and e-commerce.
- **[Portainer](https://github.com/portainer/portainer)** (Zlib) — Container management UI.
- **[Collabora Online](https://github.com/CollaboraOnline/online)** (MPL 2.0) — LibreOffice in the browser.
- **[Elasticsearch](https://github.com/elastic/elasticsearch)** (SSPL / Elastic License) — Full-text search and analytics engine.
- **[MongoDB](https://github.com/mongodb/mongo)** (SSPL) — Document database.

---

## Project Structure

```
Agant/
  compose/                  # Docker Compose modules (one per service)
    foundation-lean.yml     # PostgreSQL, MariaDB, Redis
    identity.yml            # Authentik SSO
    proxy.yml               # Caddy reverse proxy
    erp-lean.yml            # ERPNext (gunicorn + worker + scheduler)
    nextcloud-lean.yml      # Nextcloud
    mail.yml                # Stalwart Mail
    meetings.yml            # Jitsi Meet + Jibri
    automation-lean.yml     # n8n
    ...                     # + full-stack variants
  connectors/               # @oficina/connectors — AI integration layer
    src/
      erpnext/              # ERPNext Frappe REST API wrapper
      nextcloud/            # WebDAV + CalDAV + OCS API wrapper
      stalwart/             # JMAP email client
      jitsi/                # Meeting + recording access
      n8n/                  # Workflow automation API
      indexer/              # Unified DataRecord search index
      index.ts              # createOficina() factory
  config/                   # Service configurations
    caddy/Caddyfile         # Reverse proxy routes
    authentik/blueprints/   # OIDC provider auto-provisioning
    jibri/finalize.sh       # Recording → Nextcloud pipeline
    n8n/workflows/          # Pre-built automation templates
    stalwart/               # Mail server config
    superset/               # BI dashboard config
  scripts/                  # Setup, backup, SSO wiring, post-install
  docker-compose-lean.yml   # Lean stack (6 apps, 5GB RAM)
  docker-compose.yml        # Full stack (all apps)
  .env.template             # Configuration template
```

---

## License

MIT License. See [LICENSE](LICENSE).

Agant itself is MIT-licensed. The open-source projects it bundles retain their own licenses (GPL, AGPL, Apache, MIT, etc.). When you run Agant, you run each project under its respective license. We link to and orchestrate these projects — we don't fork or modify their source code.

---

## Contributing

This is day one. Everything is being built in the open. If you want to help make business software free for everyone:

1. Fork it
2. Build something
3. Open a PR

No bureaucracy. No CLAs. Just ship.

---

Built with respect for every open-source contributor whose work makes this possible.
