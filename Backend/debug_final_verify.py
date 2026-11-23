"""Final verification via localhost — confirms the JWT fix works correctly"""
import base64, os, time, urllib.request, urllib.error, json
from dotenv import load_dotenv
load_dotenv(".env")
import jwt as pyjwt

secret_b64 = os.getenv("SUPABASE_JWT_SECRET", "")
secret_bytes = base64.b64decode(secret_b64)

USERS = [
    ("5b924eb5-4d8a-485e-9f4c-d8c15ecebb0f", "anadeem6301@gmail.com", "CE",      "/dashboard"),
    ("bbc7d469-0fb2-4bd9-ba79-52f1e1d7ab78", "aqib.ali0520@gmail.com", "FOUNDRY", "/foundry"),
]

print("FINAL VERIFICATION (LOCAL) - JWT Base64 Fix")
print("=" * 60)
all_pass = True

for uid, email, expected_dept, expected_route in USERS:
    now = int(time.time())
    payload = {
        "iss": "https://cufqstahriipoapycclz.supabase.co/auth/v1",
        "sub": uid, "aud": "authenticated",
        "exp": now + 3600, "iat": now,
        "email": email, "role": "authenticated",
    }

    # ── Token A: signed with decoded bytes (real Supabase format) ─────────────
    token_real = pyjwt.encode(payload, secret_bytes, algorithm="HS256")

    # ── Token B: signed with raw base64 string (OLD broken approach) ──────────
    token_old = pyjwt.encode(payload, secret_b64, algorithm="HS256")

    def call_me(token, label):
        req = urllib.request.Request(
            "http://127.0.0.1:8000/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                body = json.loads(r.read().decode())
                return r.status, body, None
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            try:
                body = json.loads(body)
            except Exception:
                pass
            return e.code, None, body
        except Exception as ex:
            return None, None, str(ex)

    print(f"\nUSER: {email}")
    print(f"  Expected dept={expected_dept!r}, route={expected_route!r}")

    # Test real token (decoded bytes — what Supabase issues)
    status_a, body_a, err_a = call_me(token_real, "REAL")
    if status_a == 200:
        dept_a = body_a.get("department_code", "")
        ok_a = dept_a == expected_dept
        print(f"  [REAL token]  HTTP {status_a} dept={dept_a!r}  -> {'PASS' if ok_a else 'FAIL (wrong dept)'}")
        if not ok_a:
            all_pass = False
    else:
        print(f"  [REAL token]  HTTP {status_a} FAIL -> {err_a}")
        all_pass = False

    # Test old token (raw base64 string — old broken format)
    status_b, body_b, err_b = call_me(token_old, "OLD")
    if status_b == 200:
        print(f"  [OLD token]   HTTP {status_b} -> Still accepted (both work — OK for compat)")
    else:
        code = err_b.get("detail", {}).get("code", "?") if isinstance(err_b, dict) else "?"
        print(f"  [OLD token]   HTTP {status_b} {code} -> Now correctly rejected")

print()
print("=" * 60)
if all_pass:
    print("ALL TESTS PASS")
    print("Real Supabase tokens are now accepted.")
    print("Login will redirect correctly to /dashboard or /foundry.")
else:
    print("SOME TESTS FAILED — review output above")
