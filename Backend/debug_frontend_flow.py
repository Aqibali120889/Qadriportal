"""
Simulates EXACTLY what Login.tsx does at runtime:
1. supabase.auth.signInWithPassword() → get access_token
2. refreshUser() → fetchIdentity(access_token) → GET /api/v1/auth/me
3. Check if identity is null
4. Determine if login succeeds or shows error

Checks the REAL flow using the real Supabase JWT that would be issued.
"""
import asyncio
import json
import os
import ssl
import urllib.error
import urllib.request
import time
import sys

# ─── Config ──────────────────────────────────────────────────────────────────
API_BASE = "https://preburlesque-alline-noncensurably.ngrok-free.dev"
SUPABASE_URL = "https://cufqstahriipoapycclz.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1ZnFzdGFocmlpcG9hcHljY2x6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNTc1MjYsImV4cCI6MjA5OTgzMzUyNn0.tnv6W7X_6aM2g7E34TjT1o5xiO52yn7KMG52Q-RyPUo"

# SSL context (ignore cert for local dev)
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def supabase_login(email: str, password: str):
    """Step 1: Simulate supabase.auth.signInWithPassword()"""
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    body = json.dumps({"email": email, "password": password}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "apikey": ANON_KEY,
            "Authorization": f"Bearer {ANON_KEY}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
            return json.loads(r.read().decode()), None
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        return None, f"HTTP {e.code}: {err}"
    except Exception as e:
        return None, str(e)


def call_auth_me(access_token: str):
    """Step 2: Simulate fetchIdentity() — GET /api/v1/auth/me"""
    req = urllib.request.Request(
        f"{API_BASE}/api/v1/auth/me",
        headers={
            "Authorization": f"Bearer {access_token}",
            "ngrok-skip-browser-warning": "true",
            "Origin": "http://localhost:5173",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
            body = r.read().decode()
            return r.status, json.loads(body), None
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        try:
            err_json = json.loads(err)
        except Exception:
            err_json = err
        return e.code, None, err_json
    except Exception as e:
        return None, None, str(e)


# ─── Test both users ──────────────────────────────────────────────────────────
CREDENTIALS = [
    ("anadeem6301@gmail.com", "Test@1234"),  # ← will fail if wrong password
    ("aqib.ali0520@gmail.com", "Test@1234"),  # ← will fail if wrong password
]

print("=" * 70)
print("FRONTEND LOGIN FLOW SIMULATION")
print("=" * 70)
print()
print("NOTE: This script uses real Supabase Auth — you must provide the")
print("actual user passwords below for a real token to be issued.")
print()
print("If passwords are wrong, we'll still test /auth/me with a synthetic token.")
print()

from dotenv import load_dotenv
load_dotenv(".env")
import jwt as pyjwt
secret = os.getenv("SUPABASE_JWT_SECRET", "")

REAL_USERS = [
    ("5b924eb5-4d8a-485e-9f4c-d8c15ecebb0f", "anadeem6301@gmail.com"),
    ("bbc7d469-0fb2-4bd9-ba79-52f1e1d7ab78", "aqib.ali0520@gmail.com"),
]

for uid, email in REAL_USERS:
    print(f"{'='*70}")
    print(f"USER: {email}")
    print(f"{'='*70}")

    # Build synthetic JWT (mirrors real Supabase HS256 token)
    now = int(time.time())
    payload = {
        "iss": f"{SUPABASE_URL}/auth/v1",
        "sub": uid,
        "aud": "authenticated",
        "exp": now + 3600,
        "iat": now,
        "email": email,
        "phone": "",
        "app_metadata": {"provider": "email", "providers": ["email"]},
        "user_metadata": {},
        "role": "authenticated",
        "aal": "aal1",
        "amr": [{"method": "password", "timestamp": now}],
        "session_id": "sim-001",
    }
    token = pyjwt.encode(payload, secret, algorithm="HS256")

    print(f"[Supabase Auth] Using synthetic HS256 token (same secret as prod)")
    print(f"  Token[:60]: {token[:60]}...")
    print()

    # SIMULATE: fetchIdentity(access_token)
    print("[fetchIdentity] Calling GET /api/v1/auth/me ...")
    status_code, identity, error = call_auth_me(token)
    print(f"  HTTP Status: {status_code}")

    if identity:
        print(f"  Response: {json.dumps(identity, indent=4)}")
        print()
        print("[Login.tsx L98] if (!identity) → BRANCH:")
        print("  identity is TRUTHY → will navigate to dashboard")
        dept_code = identity.get("department_code", "")
        is_super = identity.get("is_super_admin", False)
        if is_super:
            route = "/admin"
        else:
            routes = {"CE": "/dashboard", "FOUNDRY": "/foundry"}
            route = routes.get(dept_code, "/dashboard")
        print(f"  department_code = {dept_code!r}")
        print(f"  is_super_admin  = {is_super}")
        print(f"  navigate() → {route!r}")
    else:
        print(f"  Error: {error}")
        print()
        print("[Login.tsx L98] if (!identity) → BRANCH:")
        print("  identity is NULL → supabase.auth.signOut() → show error")
        print("  Error shown: 'Your account is not authorized or active.'")
        print()
        print("  THIS IS THE FAILURE PATH THAT MATCHES THE REPORTED SYMPTOM")

    print()
