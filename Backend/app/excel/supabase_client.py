"""
app/excel/supabase_client.py
────────────────────────────────────────────────────────────────────────────
Direct PostgreSQL Database Client for the Excel Cost Estimation module.

Connects directly to the enterprise PostgreSQL database via DATABASE_URL
(postgresql://postgres.cufqstahriipoapycclz:...) eliminating any dependency
on PostgREST API keys or HTTP 401 Unauthorized errors.

Provides the exact same chainable interface as supabase-py:
  sb.table(...).select(...).eq(...).order(...).limit(...).single().execute()
  sb.table(...).insert({...}).execute()
  sb.table(...).update({...}).eq(...).execute()
  sb.table(...).delete().eq(...).execute()
"""
import os
import json
import uuid
import datetime
from decimal import Decimal
import asyncpg
import asyncio
from dotenv import load_dotenv

load_dotenv()
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)


def _get_pg_url() -> str:
    url = os.getenv("DATABASE_URL", "")
    if not url:
        url = "postgresql://postgres.cufqstahriipoapycclz:M.aqibali0520@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"
    if url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    return url


def _prepare_db_param(val):
    if val is None:
        return None
    if isinstance(val, (list, dict)):
        return json.dumps(val)
    if isinstance(val, uuid.UUID):
        return str(val)
    return val


def _to_json_friendly(val):
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, (datetime.datetime, datetime.date)):
        return val.isoformat()
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, str):
        if (val.startswith("[") and val.endswith("]")) or (val.startswith("{") and val.endswith("}")):
            try:
                return json.loads(val)
            except Exception:
                pass
    return val


def _clean_dict(d: dict) -> dict:
    if not d:
        return d
    return {k: _to_json_friendly(v) for k, v in d.items()}


class DirectQueryBuilder:
    def __init__(self, table_name: str):
        self.table_name = table_name
        self._select_cols = "*"
        self._filters = []
        self._order_by = None
        self._order_desc = False
        self._limit_n = None
        self._is_single = False
        self._op = "SELECT"
        self._insert_data = None
        self._update_data = None

    def select(self, cols="*"):
        self._select_cols = cols
        return self

    def eq(self, col: str, val):
        self._filters.append((col, "=", val))
        return self

    def order(self, col: str, desc: bool = False):
        self._order_by = col
        self._order_desc = desc
        return self

    def limit(self, n: int):
        self._limit_n = n
        return self

    def single(self):
        self._is_single = True
        return self

    def insert(self, data):
        self._op = "INSERT"
        self._insert_data = data
        return self

    def update(self, data):
        self._op = "UPDATE"
        self._update_data = data
        return self

    def delete(self):
        self._op = "DELETE"
        return self

    def execute(self):
        """Execute query synchronously on PostgreSQL."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If inside an existing async loop (FastAPI request thread), run in dedicated thread
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    return pool.submit(lambda: asyncio.run(self._async_execute())).result()
            else:
                return asyncio.run(self._async_execute())
        except RuntimeError:
            return asyncio.run(self._async_execute())

    async def _async_execute(self):
        pg_url = _get_pg_url()
        conn = None
        for attempt in range(3):
            try:
                conn = await asyncpg.connect(pg_url)
                break
            except Exception as conn_err:
                if attempt == 2:
                    raise conn_err
                await asyncio.sleep(0.2)
        try:
            if self._op == "SELECT":
                sql = f"SELECT {self._select_cols} FROM {self.table_name}"
                params = []
                if self._filters:
                    where_clauses = []
                    for col, op, val in self._filters:
                        params.append(_prepare_db_param(val))
                        where_clauses.append(f"{col} {op} ${len(params)}")
                    sql += " WHERE " + " AND ".join(where_clauses)
                if self._order_by:
                    direction = "DESC" if self._order_desc else "ASC"
                    sql += f" ORDER BY {self._order_by} {direction}"
                if self._limit_n:
                    sql += f" LIMIT {self._limit_n}"

                rows = await conn.fetch(sql, *params)
                data = [_clean_dict(dict(r)) for r in rows]
                if self._is_single:
                    data = data[0] if data else None
                return QueryResult(data)

            elif self._op == "INSERT":
                items = self._insert_data if isinstance(self._insert_data, list) else [self._insert_data]
                results = []
                for item in items:
                    # Exclude None or auto-generated fields if not provided
                    cols = list(item.keys())
                    placeholders = [f"${i+1}" for i in range(len(cols))]
                    vals = [_prepare_db_param(item[c]) for c in cols]
                    sql = f"INSERT INTO {self.table_name} ({', '.join(cols)}) VALUES ({', '.join(placeholders)}) RETURNING *"
                    rows = await conn.fetch(sql, *vals)
                    results.extend([_clean_dict(dict(r)) for r in rows])
                data = results if isinstance(self._insert_data, list) else (results[:1] if results else [])
                return QueryResult(data)

            elif self._op == "UPDATE":
                if not self._update_data:
                    return QueryResult([])
                cols = list(self._update_data.keys())
                set_clauses = [f"{c} = ${i+1}" for i, c in enumerate(cols)]
                vals = [_prepare_db_param(self._update_data[c]) for c in cols]
                sql = f"UPDATE {self.table_name} SET {', '.join(set_clauses)}"
                if self._filters:
                    where_clauses = []
                    for col, op, val in self._filters:
                        vals.append(_prepare_db_param(val))
                        where_clauses.append(f"{col} {op} ${len(vals)}")
                    sql += " WHERE " + " AND ".join(where_clauses)
                sql += " RETURNING *"
                rows = await conn.fetch(sql, *vals)
                data = [_clean_dict(dict(r)) for r in rows]
                return QueryResult(data)

            elif self._op == "DELETE":
                sql = f"DELETE FROM {self.table_name}"
                vals = []
                if self._filters:
                    where_clauses = []
                    for col, op, val in self._filters:
                        vals.append(_prepare_db_param(val))
                        where_clauses.append(f"{col} {op} ${len(vals)}")
                    sql += " WHERE " + " AND ".join(where_clauses)
                sql += " RETURNING *"
                rows = await conn.fetch(sql, *vals)
                data = [_clean_dict(dict(r)) for r in rows]
                return QueryResult(data)
        finally:
            await conn.close()


class QueryResult:
    def __init__(self, data):
        self.data = data


class DirectDBClient:
    def table(self, name: str) -> DirectQueryBuilder:
        return DirectQueryBuilder(name)


_client_instance = DirectDBClient()


def get_supabase() -> DirectDBClient:
    """Return shared direct database client for enterprise PostgreSQL."""
    return _client_instance


def safe_execute(query_builder, retries: int = 3, delay: float = 0.5):
    """Execute query with retries."""
    for attempt in range(retries):
        try:
            return query_builder.execute()
        except Exception as e:
            if attempt < retries - 1:
                import time
                time.sleep(delay)
            else:
                raise e
