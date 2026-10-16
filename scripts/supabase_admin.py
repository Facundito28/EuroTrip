#!/usr/bin/env python3
"""One-time, explicit administration via a proxy-bound token. Never prints secrets.
Not imported by Next.js and not required in Vercel. Default operation is read-only.
"""
import argparse
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
TABLES = ["trips", "trip_members", "trip_invitations", "expenses", "expense_shares", "settlements", "itinerary_events", "scenarios", "scenario_items", "receipts"]
MIGRATION = ROOT / "supabase/migrations/202610160001_travel_hq.sql"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["status", "apply", "configure-otp", "upgrade-password", "configure-password"], nargs="?", default="status")
    parser.add_argument("--project-ref", required=True)
    args = parser.parse_args()
    if not re.fullmatch(r"[a-z0-9]{20}", args.project_ref):
        parser.error("Invalid Supabase project reference.")
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        print("SUPABASE_ACCESS_TOKEN is missing. Add it securely in environment settings; never paste it in chat.", file=sys.stderr)
        return 2
    base = f"https://api.supabase.com/v1/projects/{args.project_ref}"

    def request(path, data=None, method=None):
        payload = json.dumps(data).encode() if data is not None else None
        req = urllib.request.Request(base + path, data=payload, method=method, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=90) as response:
            raw = response.read()
            return json.loads(raw) if raw else None

    def query(sql):
        return request("/database/query", {"query": sql}, "POST")

    def schema_status():
        # Identifiers are from the fixed allowlist above, never caller-provided SQL.
        names = ",".join("'" + t + "'" for t in TABLES)
        return query(f"select c.relname as name,c.relrowsecurity as rls from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ({names}) order by c.relname;")

    try:
        request("")  # Verify project access before any mutation.
        before = schema_status()
        if args.operation == "apply":
            if before:
                print("Refusing automatic reapplication: one or more Travel HQ tables already exist. Inspect migration history first.", file=sys.stderr)
                return 3
            query(MIGRATION.read_text())
            print("Travel HQ migration executed.")
        if args.operation in ("upgrade-password", "configure-password"):
            if len(before) != len(TABLES):
                print("Apply the base migration first.", file=sys.stderr)
                return 3
            installed = query("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='trip_invitations' and column_name='code_hash') as installed;")[0]['installed']
            if args.operation == "upgrade-password":
                if installed:
                    print("Password invitation migration already installed; no reapplication.")
                else:
                    query((ROOT / "supabase/migrations/202610160002_password_invitations.sql").read_text())
                    print("Secret invitation migration executed. Email-only joining is disabled.")
            else:
                # Never allow unverified email identities before closing the old
                # email-only membership path. The migration is transactional.
                safe = query("select exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='accept_invitation') as join_exists, regexp_replace(pg_get_functiondef('public.accept_invitations()'::regprocedure),'\\s','','g') like '%beginreturn;end;%' as legacy_disabled;")[0]
                if not installed or not safe['join_exists'] or not safe['legacy_disabled']:
                    print("Refusing Auth changes until private-code invitation security is installed.", file=sys.stderr)
                    return 4
                request("/config/auth", {"mailer_autoconfirm": True, "external_email_enabled": True, "disable_signup": False, "password_min_length": 12}, "PATCH")
                print("Password registration enabled without confirmation emails. Invitations still require a private code.")
        if args.operation == "configure-otp":
            # Update this one template only. Preserve SMTP, Site URL, redirect URLs,
            # token lifetime, signup settings and all other existing configuration.
            request("/config/auth", {"mailer_templates_magic_link_content": "<h2>Tu código de EuroTrip 2027</h2><p>{{ .Token }}</p><p>No compartas este código. Si no solicitaste el acceso, ignorá este correo.</p>"}, "PATCH")
            print("Email OTP template configured. No emails were sent.")
        after = schema_status()
        print(f"Travel HQ tables: {len(after)}/{len(TABLES)}; RLS enabled: {sum(bool(r['rls']) for r in after)}.")
        if len(after) == len(TABLES):
            checks = query("select (select count(*) from pg_catalog.pg_policies where schemaname='public' and tablename in ('trips','trip_members','trip_invitations','expenses','expense_shares','settlements','itinerary_events','scenarios','scenario_items','receipts')) as policies, (select public from storage.buckets where id='receipts') as receipts_public, has_table_privilege('anon','public.expenses','SELECT') as anon_can_read_expenses;")
            print(json.dumps(checks, ensure_ascii=False))
            if any(not r['rls'] for r in after) or checks[0]['receipts_public'] is not False or checks[0]['anon_can_read_expenses']:
                print("Remote security checks failed. Do not open the application to users.", file=sys.stderr)
                return 4
        auth = request("/config/auth")
        # This response may contain provider secrets. Report boolean status only.
        print("Email/password enabled:", bool(auth.get("external_email_enabled")))
        print("Registration without confirmation email:", bool(auth.get("mailer_autoconfirm")))
        print("OTP code in template:", "{{ .Token }}" in (auth.get("mailer_templates_magic_link_content") or ""))
        print("Custom SMTP configured:", bool(auth.get("smtp_host")))
        return 0
    except urllib.error.HTTPError as error:
        if args.operation == "configure-otp" and error.code == 400:
            # Interpret only a known non-secret service limitation, not the raw
            # Auth configuration response, which could contain SMTP credentials.
            try:
                message = json.loads(error.read()).get("message", "")
            except (ValueError, AttributeError):
                message = ""
            if "Email template modification is not available for free tier projects using the default email provider" in message:
                print("La plantilla OTP está bloqueada por el plan gratuito con el correo predeterminado. Configurá SMTP propio o cambiá el plan; el token administrativo funciona.", file=sys.stderr)
                return 5
        print(f"Supabase Management API HTTP {error.code}. Check token permissions and project access. No token or response containing secrets was printed.", file=sys.stderr)
        return 1
    except urllib.error.URLError as error:
        print(f"Supabase Management API network error: {error.reason}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
