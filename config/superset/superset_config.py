"""
Oficina Digital — Apache Superset Configuration
Connects to PostgreSQL, Redis, Authentik OIDC, and all Oficina databases.
"""
import os

# ──────────────────────────────────────────────
# Database (Superset's own metadata)
# ──────────────────────────────────────────────
SQLALCHEMY_DATABASE_URI = (
    f"postgresql://{os.environ['DATABASE_USER']}:{os.environ['DATABASE_PASSWORD']}"
    f"@{os.environ['DATABASE_HOST']}:{os.environ.get('DATABASE_PORT', '5432')}"
    f"/{os.environ['DATABASE_DB']}"
)

# ──────────────────────────────────────────────
# Redis (cache + celery broker)
# ──────────────────────────────────────────────
REDIS_URL = (
    f"redis://:{os.environ['REDIS_PASSWORD']}"
    f"@{os.environ['REDIS_HOST']}:{os.environ.get('REDIS_PORT', '6379')}/0"
)

CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "superset_",
    "CACHE_REDIS_URL": REDIS_URL,
}
DATA_CACHE_CONFIG = CACHE_CONFIG.copy()

class CeleryConfig:
    broker_url = REDIS_URL
    result_backend = REDIS_URL
    imports = ("superset.sql_lab",)

CELERY_CONFIG = CeleryConfig
SECRET_KEY = os.environ["SUPERSET_SECRET_KEY"]

# ──────────────────────────────────────────────
# Authentik OIDC Authentication
# ──────────────────────────────────────────────
from flask_appbuilder.security.manager import AUTH_OID, AUTH_OAUTH

AUTH_TYPE = AUTH_OAUTH

OAUTH_PROVIDERS = [
    {
        "name": "authentik",
        "icon": "fa-key",
        "token_key": "access_token",
        "remote_app": {
            "client_id": os.environ["SUPERSET_OIDC_CLIENT_ID"],
            "client_secret": os.environ["SUPERSET_OIDC_CLIENT_SECRET"],
            "api_base_url": f"https://auth.{os.environ.get('DOMAIN', 'oficina.local')}/application/o/",
            "access_token_url": f"https://auth.{os.environ.get('DOMAIN', 'oficina.local')}/application/o/token/",
            "authorize_url": f"https://auth.{os.environ.get('DOMAIN', 'oficina.local')}/application/o/authorize/",
            "server_metadata_url": f"https://auth.{os.environ.get('DOMAIN', 'oficina.local')}/application/o/superset/.well-known/openid-configuration",
            "client_kwargs": {"scope": "openid email profile"},
        },
    }
]

# Auto-register users from Authentik, but with the most restricted role by
# default. The Authentik group mapping below elevates trusted groups to
# Alpha/Admin on every login.
AUTH_USER_REGISTRATION = True
AUTH_USER_REGISTRATION_ROLE = "Public"
AUTH_ROLES_MAPPING = {
    "oficina-admins": ["Admin"],
    "oficina-managers": ["Alpha"],
    "oficina-employees": ["Gamma"],
}
AUTH_ROLES_SYNC_AT_LOGIN = True

# Map Authentik userinfo to Superset user fields
CUSTOM_SECURITY_MANAGER = None  # Use default, roles mapped above

# ──────────────────────────────────────────────
# Feature flags
# ──────────────────────────────────────────────
FEATURE_FLAGS = {
    "ENABLE_TEMPLATE_PROCESSING": True,
    "DASHBOARD_NATIVE_FILTERS": True,
    "DASHBOARD_CROSS_FILTERS": True,
    "EMBEDDED_SUPERSET": True,
}

# Block connections to databases via untrusted drivers/URIs. Admins must
# whitelist intended data sources through the UI after creating a read-only
# user in each target DB.
PREVENT_UNSAFE_DB_CONNECTIONS = True

ROW_LIMIT = 50000
SQL_MAX_ROW = 100000
MAPBOX_API_KEY = ""
