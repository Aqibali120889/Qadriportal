"""
Full instrumented auth pipeline trace.
Simulates get_request_context() for both users step by step.
"""
import asyncio
import os
import sys
import time

from dotenv import load_dotenv
load_dotenv(".env")

import jwt as pyjwt

# ── Step 1: JWT validation ────────────────────────────────────────────────────

secret = os.getenv("SUPABASE_JWT_SECRET", "")
print(f"JWT Secret length: {len(secret)}")

USERS = [
    ("5b924eb5-4d8a-485e-9f4c-d8c15ecebb0f", "anadeem6301@gmail.com"),
    ("bbc7d469-0fb2-4bd9-ba79-52f1e1d7ab78", "aqib.ali0520@gmail.com"),
]

ALLOWED_ALGORITHMS = ["HS256", "HS384", "HS512", "RS256", "ES256", "PS256"]

for uid, email in USERS:
    print(f"\n{'='*60}")
    print(f"USER: {email}")
    print(f"{'='*60}")

    now = int(time.time())
    payload = {
        "iss": "https://cufqstahriipoapycclz.supabase.co/auth/v1",
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
        "session_id": "test-session-001",
    }
    token = pyjwt.encode(payload, secret, algorithm="HS256")
    print(f"Synthetic token: {token[:60]}...")

    # Decode exactly as decode_access_token() does
    try:
        header_alg = pyjwt.get_unverified_header(token).get("alg")
        registered = set(pyjwt.algorithms.get_default_algorithms().keys())
        candidates = set(ALLOWED_ALGORITHMS + ([header_alg] if header_alg else []))
        allowed_algs = list(candidates.intersection(registered)) or ["HS256"]
        print(f"Header alg: {header_alg}, allowed: {sorted(allowed_algs)}")

        raw = pyjwt.decode(token, secret, algorithms=allowed_algs, options={"verify_aud": False})
        sub = raw.get("sub")
        em = raw.get("email")
        role = raw.get("role")
        exp = raw.get("exp")
        iss = raw.get("iss")
        print(f"[JWT] sub={sub}")
        print(f"[JWT] email={em}")
        print(f"[JWT] role={role}")
        print(f"[JWT] exp={exp}, valid={exp > now}")
        print(f"[JWT] iss={iss}")
        print(f"[STEP 1] JWT decode: PASS")
    except Exception as e:
        print(f"[STEP 1] JWT decode FAILED: {type(e).__name__}: {e}")
        continue

    # ── Step 2: DB lookup ────────────────────────────────────────────────────
    print()
    print("[STEP 2] Loading user from public.users...")


async def run_db_trace():
    from app.database import AsyncSessionLocal
    from app.repositories.user_repository import UserRepository
    from app.repositories.permission_repository import PermissionRepository
    from app.models.user import UserStatus
    from app.services.authorization_service import authorization_service

    for uid, email in USERS:
        print(f"\n{'='*60}")
        print(f"DB TRACE: {email} ({uid})")
        print(f"{'='*60}")

        async with AsyncSessionLocal() as db:
            # Step 2: Load user with role + department
            user_repo = UserRepository(db)
            user = await user_repo.get_by_id_with_role_and_department(uid)

            if user is None:
                print(f"[STEP 2] FAIL: user is None — not found in public.users (deleted_at check?)")
                continue
            print(f"[STEP 2] User found: id={user.id}")
            print(f"  email     = {user.email}")
            print(f"  status    = {user.status!r}")
            print(f"  is_active = {user.is_active}")
            print(f"  role_id   = {user.role_id}")
            print(f"  dept_id   = {user.department_id}")
            print(f"  deleted_at= {user.deleted_at}")

            # Step 3: Role
            role = user.role
            if role is None:
                print(f"  [WARN] user.role is None — role relationship NOT loaded")
            else:
                print(f"  role.name     = {role.name!r}")
                print(f"  role.is_system= {role.is_system}")
                print(f"  role.id       = {role.id}")

            # Step 4: Department
            dept = user.department
            if dept is None:
                print(f"  [WARN] user.department is None — department relationship NOT loaded")
            else:
                print(f"  dept.name = {dept.name!r}")
                print(f"  dept.code = {dept.code!r}")
                print(f"  dept.id   = {dept.id}")

            # Step 5: Check account status (exact logic from deps.py lines 120-132)
            print()
            print("[STEP 3] Account status validation...")
            if not user.is_active:
                print(f"  [STEP 3 FAIL] is_active=False → raises ACCOUNT_INACTIVE")
            elif user.status in (UserStatus.INACTIVE, UserStatus.LOCKED):
                print(f"  [STEP 3 FAIL] status={user.status!r} → raises ACCOUNT_INACTIVE or ACCOUNT_LOCKED")
            else:
                print(f"  [STEP 3 PASS] is_active=True, status={user.status!r}")

            # Step 6: Permissions
            print()
            print("[STEP 4] Resolving permissions...")
            if user.role_id:
                perm_repo = PermissionRepository(db)
                perms = await perm_repo.get_permissions_for_role(user.role_id)
                print(f"  permissions ({len(perms)}): {sorted(perms)}")
            else:
                print("  [WARN] role_id is None → permissions = frozenset() (empty)")
                perms = frozenset()

            # Step 7: Super admin
            is_super_admin = (
                role is not None
                and authorization_service.build_from_role(role.name, role.is_system)
            )
            print(f"  is_super_admin = {is_super_admin}")

            # Step 8: Department None check (deps.py lines 149-157)
            print()
            print("[STEP 5] Department None check...")
            if dept is None:
                print(f"  [STEP 5 FAIL] dept is None → raises NO_DEPARTMENT (HTTP 403)")
            else:
                print(f"  [STEP 5 PASS] dept.code={dept.code!r}")

            # Step 9: Build RequestContext
            print()
            print("[STEP 6] RequestContext construction...")
            try:
                from app.core.context import RequestContext
                ctx = RequestContext(
                    user_id=str(user.id),
                    department_id=str(dept.id) if dept else "",
                    department_name=dept.name if dept else "",
                    department_code=dept.code if dept else "",
                    role_id=user.role_id or "",
                    role_name=role.name if role else "",
                    permissions=perms,
                    is_super_admin=is_super_admin,
                    session_id=None,
                )
                print(f"  [STEP 6 PASS] ctx={ctx}")
            except Exception as e:
                print(f"  [STEP 6 FAIL] {type(e).__name__}: {e}")

            # Step 10: Match user_id type
            print()
            print("[STEP 7] UUID type verification (str vs UUID object)...")
            print(f"  type(user.id) = {type(user.id).__name__!r}, value={user.id!r}")
            print(f"  user_id in JWT (str) = {uid!r}")
            print(f"  Match: {str(user.id) == uid}")


asyncio.run(run_db_trace())
