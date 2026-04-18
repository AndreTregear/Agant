-- Oficina Digital: PostgreSQL database initialization
-- Creates a logical database for each service that uses PostgreSQL.
-- Runs once on first container start via docker-entrypoint-initdb.d.

-- Authentik (identity/SSO)
CREATE DATABASE authentik;

-- Nextcloud (files/calendar/contacts)
CREATE DATABASE nextcloud;

-- Apache Superset (BI/analytics)
CREATE DATABASE superset;

-- n8n (workflow automation)
CREATE DATABASE n8n;

-- Zammad (helpdesk)
CREATE DATABASE zammad;

-- agente-ceo (AI agent portal)
CREATE DATABASE agente_ceo;

-- WordPress + WooCommerce uses MariaDB (shared with ERPNext)
-- Rocket.Chat uses MongoDB
-- Stalwart uses its own embedded storage
-- RAGFlow uses Elasticsearch
