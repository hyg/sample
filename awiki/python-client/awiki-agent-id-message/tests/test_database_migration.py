"""Tests for database_migration ready-state self-healing.

[INPUT]: database_migration, local_store, temporary AWIKI_DATA_DIR
[OUTPUT]: pytest assertions for ready-state schema repair behavior
[POS]: Unit tests for database migration helpers

[PROTOCOL]:
1. Update this header when logic changes
2. Check the containing folder's CLAUDE.md after updates
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

import pytest

_scripts_dir = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(_scripts_dir))

import database_migration  # noqa: E402
import local_store  # noqa: E402

_REPAIRED_INDEXES = {
    "idx_messages_owner_thread",
    "idx_messages_owner_direction",
    "idx_e2ee_outbox_owner_status",
}


def _index_names(conn: sqlite3.Connection) -> set[str]:
    """Return non-internal SQLite index names."""
    rows = conn.execute(
        """
        SELECT name FROM sqlite_master
        WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
        """
    ).fetchall()
    return {row[0] for row in rows}


@pytest.fixture()
def prepared_v6_database(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Create a v6 database with selected indexes removed."""
    monkeypatch.setenv("AWIKI_DATA_DIR", str(tmp_path))

    conn = local_store.get_connection()
    local_store.ensure_schema(conn)
    for index_name in sorted(_REPAIRED_INDEXES):
        conn.execute(f"DROP INDEX {index_name}")
    conn.commit()
    conn.close()

    return tmp_path / "database" / "awiki.db"


def test_ensure_local_database_ready_repairs_ready_database(
    prepared_v6_database: Path,
) -> None:
    """Ready-state checks should repair missing indexes before returning."""
    result = database_migration.ensure_local_database_ready()

    assert result["status"] == "ready"
    assert result["db_path"] == str(prepared_v6_database)
    assert result["before_version"] == 6
    assert result["after_version"] == 6

    conn = local_store.get_connection()
    try:
        assert _REPAIRED_INDEXES <= _index_names(conn)
    finally:
        conn.close()


def test_migrate_local_database_repairs_ready_database_without_backup(
    prepared_v6_database: Path,
) -> None:
    """The standalone migration helper should self-heal ready databases."""
    result = database_migration.migrate_local_database()

    assert result["status"] == "ready"
    assert result["db_path"] == str(prepared_v6_database)
    assert result["before_version"] == 6
    assert result["after_version"] == 6
    assert result["backup_path"] is None

    conn = local_store.get_connection()
    try:
        assert _REPAIRED_INDEXES <= _index_names(conn)
    finally:
        conn.close()
