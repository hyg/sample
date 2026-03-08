"""Read-only SQL query CLI against local SQLite database.

Usage:
    python scripts/query_db.py "SELECT * FROM threads LIMIT 10"
    python scripts/query_db.py "SELECT * FROM messages WHERE credential_name='alice' LIMIT 10"

[INPUT]: local_store (SQLite connection + execute_sql)
[OUTPUT]: JSON query results to stdout
[POS]: CLI entry point for ad-hoc local database queries

[PROTOCOL]:
1. Update this header when logic changes
2. Check the folder's CLAUDE.md after updating
"""

from __future__ import annotations

import argparse
import json
import sys

import local_store


def main() -> None:
    parser = argparse.ArgumentParser(description="Query local SQLite database")
    parser.add_argument("sql", type=str, help="SQL statement to execute")
    parser.add_argument(
        "--credential", type=str, default=None,
        help="Credential name filter (optional, for filtering messages by credential)",
    )

    args = parser.parse_args()

    conn = local_store.get_connection()
    local_store.ensure_schema(conn)

    try:
        result = local_store.execute_sql(conn, args.sql)
        print(json.dumps(result, indent=2, ensure_ascii=False, default=str))
    except ValueError as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
