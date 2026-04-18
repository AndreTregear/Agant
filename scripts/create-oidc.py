#!/usr/bin/env python3
"""Create OIDC providers and applications in Authentik for all Oficina services."""
import json, secrets, urllib.request, urllib.error, sys, os

TOKEN = open("/opt/oficina/.authentik_token").read().strip()
AK = "http://localhost:9000/api/v3"

def api(method, path, data=None):
    url = f"{AK}/{path}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method, headers={
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"  API Error {e.code}: {err[:200]}")
        return None

def get(path): return api("GET", path)
def post(path, data): return api("POST", path, data)

# Get required PKs
print("Fetching Authentik configuration...")
flow = get("flows/instances/?slug=default-provider-authorization-implicit-consent")["results"][0]["pk"]
iflow = get("flows/instances/?slug=default-provider-invalidation-flow")["results"][0]["pk"]
certs = get("crypto/certificatekeypairs/")["results"]
skey = certs[0]["pk"] if certs else None

scopes = get("propertymappings/provider/scope/?ordering=scope_name")["results"]
scope_pks = [s["pk"] for s in scopes if s["scope_name"] in ("openid", "email", "profile")]

print(f"  Flow: {flow[:8]}...")
print(f"  Signing key: {str(skey)[:8]}...")
print(f"  Scopes: {len(scope_pks)} mappings")

# Service definitions
services = [
    {
        "name": "ERPNext",
        "slug": "erpnext",
        "client_id": "erpnext-client",
        "redirect": "http://localhost:8080/api/method/frappe.integrations.oauth2_logins.login_via_oauth2",
        "launch": "http://localhost:8080",
    },
    {
        "name": "Nextcloud",
        "slug": "nextcloud",
        "client_id": "nextcloud-client",
        "redirect": "http://localhost:8081/apps/user_oidc/code",
        "launch": "http://localhost:8081",
    },
    {
        "name": "n8n Automation",
        "slug": "n8n",
        "client_id": "n8n-client",
        "redirect": "http://localhost:5678/rest/oauth2-credential/callback",
        "launch": "http://localhost:5678",
    },
    {
        "name": "Stalwart Mail",
        "slug": "stalwart",
        "client_id": "stalwart-client",
        "redirect": "http://localhost:8082/auth/oauth",
        "launch": "http://localhost:8082",
    },
]

oidc_secrets = {}

print("\n=== Creating OIDC Providers ===\n")

for svc in services:
    client_secret = secrets.token_hex(24)
    oidc_secrets[svc["slug"]] = {"client_id": svc["client_id"], "secret": client_secret}

    print(f"Creating: {svc['name']}...")

    provider_data = {
        "name": svc["name"],
        "authorization_flow": flow,
        "invalidation_flow": iflow,
        "client_type": "confidential",
        "client_id": svc["client_id"],
        "client_secret": client_secret,
        "redirect_uris": [{"matching_mode": "strict", "url": svc["redirect"]}],
        "property_mappings": scope_pks,
        "sub_mode": "hashed_user_id",
        "include_claims_in_id_token": True,
    }
    if skey:
        provider_data["signing_key"] = skey

    result = post("providers/oauth2/", provider_data)
    if result and "pk" in result:
        pk = result["pk"]
        print(f"  Provider created: PK={pk}")
    else:
        # Try to find existing
        existing = get(f"providers/oauth2/?search={svc['client_id']}")
        if existing and existing["results"]:
            pk = existing["results"][0]["pk"]
            print(f"  Provider exists: PK={pk}")
        else:
            print(f"  FAILED to create provider")
            continue

    # Create application
    app_result = post("core/applications/", {
        "name": svc["name"],
        "slug": svc["slug"],
        "provider": pk,
        "meta_launch_url": svc["launch"],
        "policy_engine_mode": "any",
    })
    if app_result:
        print(f"  Application created: {svc['slug']}")
    else:
        print(f"  Application may already exist")

# Save secrets
print("\n=== OIDC Credentials ===\n")
with open("/opt/oficina/.oidc_secrets", "w") as f:
    for slug, creds in oidc_secrets.items():
        line = f"{slug.upper()}_OIDC_CLIENT_ID={creds['client_id']}"
        f.write(line + "\n")
        line = f"{slug.upper()}_OIDC_SECRET={creds['secret']}"
        f.write(line + "\n")
        print(f"  {slug}: {creds['client_id']} / {creds['secret']}")

# Verify
print("\n=== Verification ===\n")
apps = get("core/applications/?ordering=name")
if apps:
    for app in apps["results"]:
        print(f"  {app['name']}: {app['slug']} (provider: {app.get('provider', 'none')})")

print("\nDone!")
