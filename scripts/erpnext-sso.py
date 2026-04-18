#!/usr/bin/env python3
"""Configure ERPNext SSO with Authentik."""
import os, sys
sys.path.insert(0, "/home/frappe/frappe-bench/apps/frappe")
sys.path.insert(0, "/home/frappe/frappe-bench/apps/erpnext")
os.chdir("/home/frappe/frappe-bench/sites")

import frappe
frappe.connect(site="erp.oficina.local")

secret = os.environ.get("OIDC_SECRET", "change-me")

if not frappe.db.exists("Social Login Key", {"provider_name": "Oficina"}):
    doc = frappe.get_doc({
        "doctype": "Social Login Key",
        "provider_name": "Oficina",
        "enable_social_login": 1,
        "social_login_provider": "Custom",
        "client_id": "erpnext-client",
        "client_secret": secret,
        "base_url": "http://authentik-server:9000",
        "authorize_url": "/application/o/authorize/",
        "access_token_url": "/application/o/token/",
        "redirect_url": "/api/method/frappe.integrations.oauth2_logins.login_via_oauth2",
        "api_endpoint": "/application/o/userinfo/",
        "auth_url_data": '{"response_type": "code", "scope": "openid email profile"}',
        "icon": "fa fa-key",
        "sign_ups": "Allow"
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    print("SSO: Social Login Key 'Oficina' created")
else:
    print("SSO: Already exists")

# Set locale defaults
frappe.db.set_single_value("System Settings", "language", "es")
frappe.db.set_single_value("System Settings", "time_zone", "America/Lima")
frappe.db.commit()
print("Defaults: language=es, timezone=America/Lima")

frappe.destroy()
