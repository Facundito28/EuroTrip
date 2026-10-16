#!/usr/bin/env python3
"""Explicit real-provider integration check. Temporary users/data are removed.
No credential, password, access token, invitation or signed URL is printed.
"""
import json
import os
from pathlib import Path
import secrets
import sys
import urllib.request
import urllib.error
import uuid

ROOT = Path(__file__).resolve().parents[1]
PROJECT_REF = "wehyamqphrvizksxhpzn"
BASE = f"https://{PROJECT_REF}.supabase.co"
MANAGEMENT = f"https://api.supabase.com/v1/projects/{PROJECT_REF}"


def main():
    config = dict(os.environ)
    local = ROOT / ".env.local"
    if local.exists():
        for line in local.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                name, value = line.split("=", 1)
                config.setdefault(name, value)
    public_key = config.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    admin_token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not public_key or not admin_token:
        print("Missing configured public key or secure administrative binding.")
        return 2

    def request(url, method="GET", data=None, bearer=None, raw=False):
        headers = {"Content-Type": "image/png" if raw else "application/json"}
        if url.startswith(BASE):
            headers["apikey"] = public_key
            headers["Prefer"] = "return=representation"
        if bearer:
            headers["Authorization"] = "Bearer " + bearer
        payload = data if raw else json.dumps(data).encode() if data is not None else None
        req = urllib.request.Request(url, data=payload, method=method, headers=headers)
        with urllib.request.urlopen(req, timeout=40) as response:
            body = response.read()
            if raw or not body:
                return body
            return json.loads(body)

    def management(path="", data=None):
        return request(MANAGEMENT + path, "POST" if data is not None else "GET", data, admin_token)

    def rpc(token, function, args):
        return request(BASE + "/rest/v1/rpc/" + function, "POST", args, token)

    # Used only in memory for supported Auth Admin cleanup, never by the app.
    keys = management("/api-keys?reveal=true")
    service_key = next((key.get("api_key") for key in keys if key.get("name") == "service_role"), None)
    if not service_key:
        print("No cleanup credential available; no test users were created.")
        return 2
    users = []
    trip = None
    object_path = None
    tokens = []
    failures = []
    try:
        run = uuid.uuid4().hex[:12]
        for index in range(5):
            email = f"hq-check-{run}-{index}@example.com"
            password = secrets.token_urlsafe(24)
            signup = request(BASE + "/auth/v1/signup", "POST", {"email": email, "password": password})
            users.append(signup["user"]["id"])
            token = signup.get("access_token")
            assert token, "Signup still requires email."
            session = request(BASE + "/auth/v1/token?grant_type=password", "POST", {"email": email, "password": password})
            tokens.append(session["access_token"])
        print("PASS: five temporary accounts signed up and signed in without email.")
        owner = tokens[0]
        trip = rpc(owner, "create_trip", {"p_name": "Verificación temporal Travel HQ", "p_display_name": "Verificación temporal"})
        for index in range(1, 4):
            code = rpc(owner, "create_invitation", {"p_trip": trip, "p_email": f"hq-check-{run}-{index}@example.com"})
            assert request(BASE + "/rest/v1/trips?select=id", bearer=tokens[index]) == []
            try:
                rpc(tokens[4], "accept_invitation", {"p_code": code})
                raise AssertionError("Wrong identity accepted an invitation.")
            except urllib.error.HTTPError as error:
                assert error.code == 400
            assert rpc(tokens[index], "accept_invitation", {"p_code": code}) == trip
        print("PASS: four members joined; email alone and wrong identities cannot join.")
        request(BASE + "/rest/v1/trip_members?trip_id=eq." + trip + "&user_id=eq." + users[1], "PATCH", {"display_name": "Nombre propio temporal"}, tokens[1])
        renamed = rpc(tokens[1], "hq_snapshot", {"p_trip": trip})["members"]
        assert next(m for m in renamed if m["user_id"] == users[1])["display_name"] == "Nombre propio temporal"
        denied = request(BASE + "/rest/v1/trip_members?trip_id=eq." + trip + "&user_id=eq." + users[0], "PATCH", {"display_name": "No permitido"}, tokens[1])
        assert denied == []
        request(BASE + "/rest/v1/trip_members?trip_id=eq." + trip + "&user_id=eq." + users[1], "PATCH", {"display_name": "Nombre por organizador"}, owner)
        assert next(m for m in rpc(owner, "hq_snapshot", {"p_trip": trip})["members"] if m["user_id"] == users[1])["display_name"] == "Nombre por organizador"
        print("PASS: self and organizer can rename; another traveler cannot rename others.")
        rpc(tokens[1], "save_personal_budget", {"p_trip": trip, "p_budget": 123456})
        assert rpc(tokens[1], "hq_snapshot", {"p_trip": trip})["personal_budget_minor"] == 123456
        assert rpc(owner, "hq_snapshot", {"p_trip": trip})["personal_budget_minor"] is None
        assert request(BASE + "/rest/v1/personal_budgets?select=budget_minor", bearer=owner) == []
        request(BASE + "/rest/v1/trips?id=eq." + trip, "PATCH", {"usd_per_eur": "1.10", "display_rate_date": "2026-10-16"}, owner)
        assert rpc(owner, "hq_snapshot", {"p_trip": trip})["trip"]["usd_per_eur"] == "1.10000000"
        print("PASS: private personal limits and exact manual display FX on real Supabase.")
        request(BASE + "/rest/v1/itinerary_events", "POST", {"trip_id": trip, "title": "Visita temporal", "city": "Madrid", "location": "Museo temporal", "starts_on": "2027-04-22", "ends_on": "2027-04-22", "kind": "activity", "start_time": "10:00", "end_time": "12:00", "time_zone": "Europe/Madrid"}, owner)
        event = rpc(tokens[1], "hq_snapshot", {"p_trip": trip})["events"][0]
        assert event["start_time"] == "10:00:00" and event["location"] == "Museo temporal"
        assert request(BASE + "/rest/v1/itinerary_events?select=id", bearer=tokens[4]) == []
        print("PASS: real itinerary locations and destination times, shared only with members.")
        payload = {"p_id": None, "p_trip": trip, "p_description": "Verificación temporal", "p_category": "Comida", "p_amount": 10001, "p_currency": "USD", "p_rate": "0.9", "p_rate_date": "2027-04-22", "p_date": "2027-04-22", "p_status": "reserved", "p_payer": users[0], "p_members": users[:4], "p_notes": "Registro temporal; eliminado al terminar.", "p_request": str(uuid.uuid4())}
        expense = rpc(owner, "save_expense", payload)
        assert rpc(owner, "save_expense", payload) == expense
        rpc(owner, "mark_expense_paid", {"p_id": expense, "p_trip": trip})
        snapshot = rpc(tokens[1], "hq_snapshot", {"p_trip": trip})
        assert len(snapshot["expenses"]) == 1 and snapshot["expenses"][0]["eur_minor"] == 9001
        assert snapshot["expenses"][0]["status"] == "paid"
        assert sum(share["amount_minor"] for share in snapshot["shares"]) == 9001
        assert request(BASE + "/rest/v1/expenses?select=id", bearer=tokens[4]) == []
        print("PASS: real expense conversion, exact shares, deduplication and RLS isolation.")
        advanced = dict(payload, p_description="Cuotas temporales", p_amount=80000, p_status="reserved", p_request=str(uuid.uuid4()), p_method="percent", p_weights=[6000,4000], p_members=users[:2])
        advanced_id = rpc(owner,"save_expense_v2",advanced)
        payment = {"p_trip":trip,"p_expense":advanced_id,"p_request":str(uuid.uuid4()),"p_payer":users[1],"p_amount":20000,"p_rate":"0.95","p_rate_date":"2027-04-23","p_date":"2027-04-23","p_notes":"Seña temporal"}
        payment_id=rpc(owner,"add_expense_payment",payment)
        assert rpc(owner,"add_expense_payment",payment)==payment_id
        ledger=rpc(owner,"hq_snapshot",{"p_trip":trip})
        partial=next(e for e in ledger["expenses"] if e["id"]==advanced_id)
        assert partial["paid_eur_minor"]==19000 and partial["paid_original_minor"]==20000 and partial["status"]=="reserved"
        rpc(owner,"add_expense_payment",dict(payment,p_request=str(uuid.uuid4()),p_payer=users[0],p_amount=60000,p_rate="1"))
        full=next(e for e in rpc(owner,"hq_snapshot",{"p_trip":trip})["expenses"] if e["id"]==advanced_id)
        assert full["paid_eur_minor"]==79000 and full["status"]=="paid"
        assert request(BASE+"/rest/v1/expense_payments?select=id",bearer=tokens[4])==[]
        assert request(BASE+"/rest/v1/activity_log?select=id",bearer=tokens[4])==[]
        rpc(owner,"delete_expense_payment",{"p_trip":trip,"p_payment":payment_id})
        assert next(e for e in rpc(owner,"hq_snapshot",{"p_trip":trip})["expenses"] if e["id"]==advanced_id)["status"]=="reserved"
        print("PASS: unequal split, partial payments with different payers/rates, deduplication, reversal and private audit.")
        icon = (ROOT / "public/icon-192.png").read_bytes()
        png = icon + bytes(5 * 1024 * 1024 - len(icon))
        object_path = f"{trip}/{expense}/{uuid.uuid4()}.png"
        ticket = request(BASE + "/storage/v1/object/upload/sign/receipts/" + object_path, "POST", {}, owner)
        request(BASE + "/storage/v1" + ticket['url'], "PUT", png, raw=True)
        info = request(BASE + "/storage/v1/object/info/receipts/" + object_path, bearer=owner)
        assert info['size'] == len(png) and info['content_type'] == 'image/png'
        request(BASE + "/rest/v1/receipts", "POST", {"trip_id": trip, "expense_id": expense, "path": object_path, "filename": "verificacion-temporal.png"}, owner)
        signed = request(BASE + "/storage/v1/object/sign/receipts/" + object_path, "POST", {"expiresIn": 60}, tokens[1])
        signed_path = signed.get("signedURL") or signed.get("signedUrl")
        assert signed_path
        # Signed URLs are credentials; never log them.
        signed_url = BASE + "/storage/v1" + signed_path
        with urllib.request.urlopen(signed_url, timeout=30) as response:
            assert response.read() == png
        try:
            request(BASE + "/storage/v1/object/sign/receipts/" + object_path, "POST", {"expiresIn": 60}, tokens[4])
            raise AssertionError("Outsider obtained a signed URL.")
        except urllib.error.HTTPError as error:
            assert error.code in (400, 403, 404)
        print("PASS: direct signed 5 MiB Storage upload, verified size, private download and outsider rejection.")
        updated_password = secrets.token_urlsafe(24)
        request(BASE + "/auth/v1/user", "PUT", {"password": updated_password}, owner)
        session = request(BASE + "/auth/v1/token?grant_type=password", "POST", {"email": f"hq-check-{run}-0@example.com", "password": updated_password})
        assert session.get("access_token")
        print("PASS: password change and subsequent login without email.")
    except urllib.error.HTTPError as error:
        failures.append(f"Provider request failed: HTTP {error.code}; sensitive response withheld.")
    except Exception as error:
        failures.append(f"Integration assertion failed: {type(error).__name__}; sensitive context withheld.")
    finally:
        if object_path and tokens:
            try:
                request(BASE + "/storage/v1/object/receipts", "DELETE", {"prefixes": [object_path]}, tokens[0])
            except Exception:
                failures.append("Temporary object cleanup requires attention.")
        if trip:
            try:
                # IDs are validated UUIDs returned by the API, never raw user SQL.
                trip_id, owner_id = str(uuid.UUID(trip)), str(uuid.UUID(users[0]))
                management("/database/query", {"query": f"begin; delete from public.itinerary_events where trip_id='{trip_id}'::uuid; delete from public.expenses where trip_id='{trip_id}'::uuid; delete from public.settlements where trip_id='{trip_id}'::uuid; delete from public.trips where id='{trip_id}'::uuid and owner_id='{owner_id}'::uuid; commit;"})
            except Exception:
                failures.append("Temporary trip cleanup requires attention.")
        for user in users:
            try:
                request(BASE + "/auth/v1/admin/users/" + str(uuid.UUID(user)), "DELETE", {"should_soft_delete": False}, service_key)
            except Exception:
                failures.append("Temporary account cleanup requires attention.")
        if not any("cleanup" in message for message in failures):
            print(f"CLEANUP: removed {len(users)} temporary accounts and all temporary trip data.")
    for failure in failures:
        print(failure, file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
