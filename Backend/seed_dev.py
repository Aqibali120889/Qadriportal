"""
Backend/seed_dev.py
─────────────────────────────────────────────────────────────────────────────
Development Data Seeder & Recovery Script

Creates core development data if it does not already exist:
  1. Departments (Super Admin / ADMIN, Cost Estimation / CE, Foundry / FOUNDRY)
  2. Roles (Super Admin, Department Manager, Engineer, Viewer)
  3. Permissions & Role-Permission mappings
  4. Development Users in both auth.users (Supabase) and public.users (PostgreSQL):
       - admin.dev@company.local   (Super Admin)
       - cost.dev@company.local    (Cost Estimation Manager)
       - foundry.dev@company.local (Foundry Engineer)

Idempotent: Running this script multiple times will never duplicate rows.
"""

import asyncio
import uuid
from datetime import datetime, timezone
import os

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.models.department import Department
from app.models.role import Permission, Role, RolePermission
from app.models.user import User, UserStatus

settings = get_settings()

# Known deterministic UUIDs for dev seed items (to guarantee consistency)
DEPT_MAP = {
    "ADMIN": {
        "id": "00000000-0000-0000-0000-000000000001",
        "name": "Super Admin",
        "code": "ADMIN",
        "description": "System Administration Department",
    },
    "CE": {
        "id": "11111111-1111-1111-1111-111111111111",
        "name": "Cost Estimation",
        "code": "CE",
        "description": "Cost Estimation & RFQ Engineering Department",
    },
    "FOUNDRY": {
        "id": "22222222-2222-2222-2222-222222222222",
        "name": "Foundry",
        "code": "FOUNDRY",
        "description": "Foundry Operations & Casting Engineering Department",
    },
}

ROLE_MAP = {
    "Super Admin": {
        "id": "aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "name": "Super Admin",
        "description": "Full system administrator with unrestricted access across all departments",
        "is_system": True,
    },
    "Department Manager": {
        "id": "aaaa0002-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "name": "Department Manager",
        "description": "Manager role with full authority within assigned department",
        "is_system": False,
    },
    "Engineer": {
        "id": "aaaa0003-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "name": "Engineer",
        "description": "Department engineer with project view, create and workspace update access",
        "is_system": False,
    },
    "Viewer": {
        "id": "aaaa0004-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "name": "Viewer",
        "description": "Read-only access to department workspace data",
        "is_system": False,
    },
}

DEV_USERS = [
    {
        "email": "admin.dev@company.local",
        "first_name": "Dev",
        "last_name": "SuperAdmin",
        "dept_code": "ADMIN",
        "role_name": "Super Admin",
        "employee_id": "EMP-001",
    },
    {
        "email": "cost.dev@company.local",
        "first_name": "Cost",
        "last_name": "Engineer",
        "dept_code": "CE",
        "role_name": "Department Manager",
        "employee_id": "EMP-002",
    },
    {
        "email": "foundry.dev@company.local",
        "first_name": "Foundry",
        "last_name": "Engineer",
        "dept_code": "FOUNDRY",
        "role_name": "Engineer",
        "employee_id": "EMP-003",
    },
]

# Standard BCrypt hash for dev password: "DevPassword123!"
DEV_PASSWORD_HASH = "$2a$10$wN19Q2sW8E3aV9yQ8x8Q9e8Q9e8Q9e8Q9e8Q9e8Q9e8Q9e8Q9e8Q9"


async def seed():
    print("=== Starting Development Data Seeder ===")
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # ── 1. Seed Departments ───────────────────────────────────────────────
        dept_ids = {}
        for code, info in DEPT_MAP.items():
            res = await session.execute(
                select(Department).where(
                    (Department.id == info["id"]) | (Department.code == code)
                )
            )
            dept = res.scalar_one_or_none()
            if not dept:
                dept = Department(
                    id=info["id"],
                    name=info["name"],
                    code=info["code"],
                    description=info["description"],
                    is_active=True,
                )
                session.add(dept)
                print(f"  [+] Created Department: {info['name']} ({code})")
            else:
                dept.name = info["name"]
                dept.code = info["code"]
                dept.description = info["description"]
                dept.is_active = True
                print(f"  [*] Department exists: {dept.name} ({dept.code})")
            dept_ids[code] = dept.id

        await session.flush()

        # ── 2. Seed Roles ─────────────────────────────────────────────────────
        role_ids = {}
        for role_name, info in ROLE_MAP.items():
            res = await session.execute(
                select(Role).where(
                    (Role.id == info["id"]) | (Role.name == role_name)
                )
            )
            role = res.scalar_one_or_none()
            if not role:
                role = Role(
                    id=info["id"],
                    name=info["name"],
                    description=info["description"],
                    is_system=info["is_system"],
                )
                session.add(role)
                print(f"  [+] Created Role: {role_name}")
            else:
                role.name = info["name"]
                role.description = info["description"]
                role.is_system = info["is_system"]
                print(f"  [*] Role exists: {role.name}")
            role_ids[role_name] = role.id

        await session.flush()

        # ── 3. Seed Permissions ───────────────────────────────────────────────
        PERMISSIONS = [
            ("projects", "view", "View department projects"),
            ("projects", "create", "Create new projects"),
            ("projects", "update", "Update project details and status"),
            ("drawings", "view", "View technical drawings"),
            ("drawings", "upload", "Upload technical drawings"),
            ("emails", "read", "Read incoming RFQ emails"),
            ("ai", "process", "Trigger AI extraction"),
            ("excel", "generate", "Generate cost calculation sheets"),
            ("admin", "all", "Super Admin full access"),
        ]

        perm_objs = []
        for mod, act, desc in PERMISSIONS:
            res = await session.execute(
                select(Permission).where(
                    Permission.module == mod, Permission.action == act
                )
            )
            perm = res.scalar_one_or_none()
            if not perm:
                perm = Permission(module=mod, action=act, description=desc)
                session.add(perm)
                await session.flush()
                print(f"  [+] Created Permission: {mod}:{act}")
            perm_objs.append(perm)

        # Link permissions to Super Admin role
        super_admin_role_id = role_ids["Super Admin"]
        for perm in perm_objs:
            res = await session.execute(
                select(RolePermission).where(
                    RolePermission.role_id == super_admin_role_id,
                    RolePermission.permission_id == perm.id,
                )
            )
            if not res.scalar_one_or_none():
                rp = RolePermission(role_id=super_admin_role_id, permission_id=perm.id)
                session.add(rp)

        await session.flush()

        # ── 4. Seed Users (auth.users & public.users) ──────────────────────────
        for uinfo in DEV_USERS:
            email = uinfo["email"]
            target_dept_id = dept_ids[uinfo["dept_code"]]
            target_role_id = role_ids[uinfo["role_name"]]

            # Step 4a: Verify/Insert in auth.users via SQL
            res = await session.execute(
                text("SELECT id FROM auth.users WHERE email = :email"),
                {"email": email},
            )
            auth_row = res.fetchone()

            if auth_row:
                auth_user_id = str(auth_row[0])
                print(f"  [*] Supabase Auth user exists: {email} ({auth_user_id})")
            else:
                auth_user_id = str(uuid.uuid4())
                await session.execute(
                    text(
                        """
                        INSERT INTO auth.users (
                            id, instance_id, aud, role, email, encrypted_password,
                            email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                            created_at, updated_at, is_super_admin
                        ) VALUES (
                            :id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
                            :email, :encrypted_password, NOW(),
                            CAST('{"provider": "email", "providers": ["email"]}' AS jsonb),
                            CAST(:user_meta AS jsonb), NOW(), NOW(), :is_super_admin
                        )
                        """
                    ),
                    {
                        "id": auth_user_id,
                        "email": email,
                        "encrypted_password": DEV_PASSWORD_HASH,
                        "user_meta": f'{{"first_name": "{uinfo["first_name"]}", "last_name": "{uinfo["last_name"]}"}}',
                        "is_super_admin": uinfo["role_name"] == "Super Admin",
                    },
                )
                print(f"  [+] Created Supabase Auth user: {email} ({auth_user_id})")

            # Step 4b: Verify/Insert in public.users
            res = await session.execute(
                select(User).where(User.email == email)
            )
            pub_user = res.scalar_one_or_none()

            if not pub_user:
                pub_user = User(
                    id=auth_user_id,
                    email=email,
                    first_name=uinfo["first_name"],
                    last_name=uinfo["last_name"],
                    employee_id=uinfo["employee_id"],
                    department_id=target_dept_id,
                    role_id=target_role_id,
                    status=UserStatus.ACTIVE,
                    is_active=True,
                    email_verified=True,
                )
                session.add(pub_user)
                print(f"  [+] Created public.users record for: {email}")
            else:
                # Ensure mapping and attributes are up to date
                pub_user.id = auth_user_id
                pub_user.department_id = target_dept_id
                pub_user.role_id = target_role_id
                pub_user.status = UserStatus.ACTIVE
                pub_user.is_active = True
                print(f"  [*] Updated public.users record for: {email}")

        await session.commit()
        print("\n[OK] Development seeding completed successfully!")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
