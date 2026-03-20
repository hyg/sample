#!/usr/bin/env python
"""蒸馏脚本：执行 test_local_store.py 并记录黄金标准输出。

此脚本执行 python/tests/test_local_store.py 中的测试，
记录输入输出作为"黄金标准"。
"""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

# 添加 scripts 目录到路径
# distill.py 位于: doc/tests/test_local_store.py/distill.py
# python/scripts 位于: python/scripts/
# 需要向上 3 层到项目根，然后进入 python/scripts
_project_root = Path(__file__).resolve().parent.parent.parent.parent
_scripts_dir = _project_root / "python" / "scripts"
sys.path.insert(0, str(_scripts_dir))

import local_store


def format_output(data: any) -> str:
    """格式化输出数据为 JSON 字符串。"""
    return json.dumps(data, indent=2, ensure_ascii=False, default=str)


def run_distillation():
    """执行蒸馏过程，记录黄金标准输出。"""
    results = {}
    
    print("=" * 60)
    print("蒸馏脚本：test_local_store.py")
    print("=" * 60)
    
    # 创建临时数据库
    with tempfile.TemporaryDirectory() as tmp_path:
        import os
        os.environ["AWIKI_DATA_DIR"] = tmp_path
        conn = local_store.get_connection()
        local_store.ensure_schema(conn)
        
        # ========== TestSchema ==========
        print("\n[1] TestSchema")
        print("-" * 40)
        
        # test_tables_created
        tables = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        results["schema_tables"] = sorted(tables)
        print(f"Tables: {sorted(tables)}")
        
        # test_views_created
        views = {
            row[0] for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='view'"
            ).fetchall()
        }
        results["schema_views"] = sorted(views)
        print(f"Views: {sorted(views)}")
        
        # test_expected_indexes_created
        indexes = {
            row[0] for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='index'"
            ).fetchall()
        }
        results["schema_indexes"] = sorted(indexes)
        print(f"Indexes count: {len(indexes)}")
        
        # test_schema_version
        version = conn.execute("PRAGMA user_version").fetchone()[0]
        results["schema_version"] = version
        print(f"Schema version: {version}")
        
        # test_wal_mode
        mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
        results["journal_mode"] = mode
        print(f"Journal mode: {mode}")
        
        # ========== TestThreadId ==========
        print("\n[2] TestThreadId")
        print("-" * 40)
        
        # test_dm_sorted
        tid1 = local_store.make_thread_id("did:a", peer_did="did:b")
        tid2 = local_store.make_thread_id("did:b", peer_did="did:a")
        results["thread_id_dm"] = {"tid1": tid1, "tid2": tid2, "equal": tid1 == tid2}
        print(f"DM thread ID (a,b): {tid1}")
        print(f"DM thread ID (b,a): {tid2}")
        print(f"Equal: {tid1 == tid2}")
        
        # test_group
        tid_group = local_store.make_thread_id("did:a", group_id="g1")
        results["thread_id_group"] = tid_group
        print(f"Group thread ID: {tid_group}")
        
        # ========== TestStoreMessage ==========
        print("\n[3] TestStoreMessage")
        print("-" * 40)
        
        # test_store_and_retrieve
        local_store.store_message(
            conn,
            msg_id="m1",
            owner_did="did:self",
            thread_id="dm:a:b",
            direction=0,
            sender_did="did:a",
            content="hello",
        )
        row = conn.execute("SELECT * FROM messages WHERE msg_id='m1'").fetchone()
        results["store_message"] = dict(row)
        print(f"Stored message: {row['content']}")
        
        # test_dedup_scoped_by_owner_did
        local_store.store_message(
            conn,
            msg_id="m_dup",
            owner_did="did:alice",
            thread_id="dm:a:b",
            direction=0,
            sender_did="did:a",
            content="hello",
        )
        local_store.store_message(
            conn,
            msg_id="m_dup",
            owner_did="did:alice",
            thread_id="dm:a:b",
            direction=0,
            sender_did="did:a",
            content="hello",
        )
        local_store.store_message(
            conn,
            msg_id="m_dup",
            owner_did="did:bob",
            thread_id="dm:a:b",
            direction=0,
            sender_did="did:a",
            content="hello",
        )
        count = conn.execute(
            "SELECT COUNT(*) FROM messages WHERE msg_id='m_dup'"
        ).fetchone()[0]
        results["dedup_count"] = count
        print(f"Dedup count (expected 2): {count}")
        
        # ========== TestStoreMessagesBatch ==========
        print("\n[4] TestStoreMessagesBatch")
        print("-" * 40)
        
        batch = [
            {"msg_id": f"b{i}", "thread_id": "dm:a:b", "direction": 0,
             "sender_did": "did:a", "content": f"msg {i}"}
            for i in range(3)
        ]
        local_store.store_messages_batch(conn, batch, owner_did="did:alice")
        owners = {
            row["owner_did"]
            for row in conn.execute("SELECT owner_did FROM messages WHERE msg_id LIKE 'b%'").fetchall()
        }
        results["batch_owners"] = sorted(owners)
        print(f"Batch owners: {sorted(owners)}")
        
        # ========== TestUpsertContact ==========
        print("\n[5] TestUpsertContact")
        print("-" * 40)
        
        local_store.upsert_contact(
            conn,
            owner_did="did:alice",
            did="did:c1",
            name="Alice",
            handle="alice",
        )
        row = conn.execute(
            "SELECT * FROM contacts WHERE owner_did='did:alice' AND did='did:c1'"
        ).fetchone()
        results["contact"] = {"name": row["name"], "handle": row["handle"]}
        print(f"Contact: {row['name']} ({row['handle']})")
        
        # ========== TestRelationshipEvents ==========
        print("\n[6] TestRelationshipEvents")
        print("-" * 40)
        
        event_id = local_store.append_relationship_event(
            conn,
            owner_did="did:alice",
            target_did="did:bob",
            target_handle="bob.awiki.ai",
            event_type="ai_recommended",
            source_type="meetup",
            source_name="OpenClaw Meetup Hangzhou 2026",
            source_group_id="grp_1",
            reason="Strong protocol fit",
            score=0.91,
            status="pending",
            metadata={"why": "shared infra focus"},
            credential_name="alice",
        )
        row = conn.execute(
            "SELECT * FROM relationship_events WHERE event_id = ?",
            (event_id,),
        ).fetchone()
        results["relationship_event"] = {
            "event_type": row["event_type"],
            "target_did": row["target_did"],
            "score": row["score"],
            "status": row["status"],
        }
        print(f"Event: {row['event_type']} for {row['target_did']}")
        
        # ========== TestGroups ==========
        print("\n[7] TestGroups")
        print("-" * 40)
        
        local_store.upsert_group(
            conn,
            owner_did="did:alice",
            group_id="grp_1",
            name="OpenClaw Meetup",
            my_role="owner",
            membership_status="active",
            join_enabled=True,
            join_code="314159",
            join_code_expires_at="2026-03-10T12:00:00+00:00",
            group_owner_did="did:alice",
            group_owner_handle="alice.awiki.ai",
            credential_name="alice",
        )
        row = conn.execute(
            "SELECT * FROM groups WHERE owner_did='did:alice' AND group_id='grp_1'"
        ).fetchone()
        results["group"] = {
            "name": row["name"],
            "my_role": row["my_role"],
            "join_code": row["join_code"],
        }
        print(f"Group: {row['name']} (role: {row['my_role']})")
        
        # ========== TestE2eeOutbox ==========
        print("\n[8] TestE2eeOutbox")
        print("-" * 40)
        
        outbox_id = local_store.queue_e2ee_outbox(
            conn,
            owner_did="did:alice",
            peer_did="did:b",
            plaintext="secret",
            session_id="sess-1",
            credential_name="alice",
        )
        record = local_store.get_e2ee_outbox(
            conn,
            outbox_id=outbox_id,
            owner_did="did:alice",
        )
        results["e2ee_outbox"] = {
            "peer_did": record["peer_did"],
            "owner_did": record["owner_did"],
        }
        print(f"E2EE outbox: peer={record['peer_did']}")
        
        # ========== TestViews ==========
        print("\n[9] TestViews")
        print("-" * 40)
        
        local_store.store_message(
            conn,
            msg_id="v1",
            owner_did="did:alice",
            thread_id="group:g1",
            direction=0,
            sender_did="did:x",
            content="hello",
        )
        local_store.store_message(
            conn,
            msg_id="v2",
            owner_did="did:bob",
            thread_id="group:g1",
            direction=0,
            sender_did="did:x",
            content="world",
        )
        rows = conn.execute(
            "SELECT owner_did, thread_id, message_count FROM threads ORDER BY owner_did"
        ).fetchall()
        results["threads_view"] = [dict(row) for row in rows]
        print(f"Threads view count: {len(rows)}")
        
        # ========== TestExecuteSql ==========
        print("\n[10] TestExecuteSql")
        print("-" * 40)
        
        result = local_store.execute_sql(conn, "SELECT COUNT(*) as cnt FROM messages")
        results["sql_select_count"] = result[0]["cnt"]
        print(f"SQL SELECT count: {result[0]['cnt']}")
        
        # 测试 DROP 被拒绝
        drop_rejected = False
        try:
            local_store.execute_sql(conn, "DROP TABLE messages")
        except ValueError as e:
            drop_rejected = True
            results["sql_drop_rejected"] = drop_rejected
            print(f"DROP rejected: {drop_rejected}")
        
        conn.close()
    
    # 输出黄金标准结果
    print("\n" + "=" * 60)
    print("黄金标准输出")
    print("=" * 60)
    print(format_output(results))
    
    return results


if __name__ == "__main__":
    run_distillation()
