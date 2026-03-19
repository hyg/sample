#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Distillation script for local_store.py - records input/output as golden standard."""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

# 添加 python/scripts 目录到路径以便导入
scripts_dir = Path(__file__).resolve().parent.parent.parent.parent / "python" / "scripts"
sys.path.insert(0, str(scripts_dir))

# 添加 python 目录到路径以便导入 utils
python_dir = Path(__file__).resolve().parent.parent.parent.parent / "python"
sys.path.insert(0, str(python_dir))

# 配置日志
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("distill")

# ============================================================================
# 蒸馏记录器
# ============================================================================

class DistillRecorder:
    """记录输入输出作为黄金标准。"""
    
    def __init__(self, output_path: str):
        self.output_path = output_path
        self.records: list[dict] = []
    
    def record(self, category: str, function: str, inputs: dict, outputs: dict, status: str = "success"):
        """记录一次函数调用。"""
        self.records.append({
            "category": category,
            "function": function,
            "inputs": inputs,
            "outputs": outputs,
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    def save(self):
        """保存记录到文件。"""
        with open(self.output_path, "w", encoding="utf-8") as f:
            json.dump({
                "source_file": "python/scripts/local_store.py",
                "distill_date": datetime.now(timezone.utc).isoformat(),
                "total_records": len(self.records),
                "records": self.records
            }, f, indent=2, ensure_ascii=False)
        logger.info(f"保存蒸馏记录到 {self.output_path}")


# ============================================================================
# 测试辅助函数
# ============================================================================

def create_test_connection(db_path: str) -> sqlite3.Connection:
    """创建测试数据库连接。"""
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.row_factory = sqlite3.Row
    return conn


# ============================================================================
# 蒸馏测试
# ============================================================================

def distill_schema_operations(recorder: DistillRecorder, conn: sqlite3.Connection):
    """蒸馏模式操作函数。"""
    logger.info("测试模式操作函数...")
    
    from local_store import _table_exists, ensure_schema
    
    tables_before = ["messages", "contacts", "e2ee_outbox", "groups", "group_members", "relationship_events"]
    table_status_before = {t: _table_exists(conn, t) for t in tables_before}
    
    recorder.record(
        category="schema",
        function="_table_exists (before ensure_schema)",
        inputs={"tables": tables_before},
        outputs={"exists": table_status_before},
        status="success"
    )
    
    ensure_schema(conn)
    
    table_status_after = {t: _table_exists(conn, t) for t in tables_before}
    
    recorder.record(
        category="schema",
        function="ensure_schema",
        inputs={"connection": "sqlite3.Connection"},
        outputs={"tables_created": table_status_after},
        status="success"
    )
    
    from local_store import _schema_object_exists
    
    views = ["threads", "inbox", "outbox"]
    view_status = {v: _schema_object_exists(conn, object_type="view", object_name=v) for v in views}
    
    recorder.record(
        category="schema",
        function="_ensure_v6_views",
        inputs={"views": views},
        outputs={"exists": view_status},
        status="success"
    )
    
    logger.info("模式操作函数测试完成")


def distill_message_operations(recorder: DistillRecorder, conn: sqlite3.Connection):
    """蒸馏消息操作函数。"""
    logger.info("测试消息操作函数...")
    
    from local_store import (
        ensure_schema, store_message, store_messages_batch,
        get_message_by_id, make_thread_id
    )
    
    ensure_schema(conn)
    
    test_owner_did = "did:wba:awiki.ai:user:k1_test_owner"
    test_peer_did = "did:wba:awiki.ai:user:k1_test_peer"
    test_msg_id = "msg_distill_001"
    test_content = "测试消息内容"
    test_credential = "distill_test"
    
    thread_id = make_thread_id(test_owner_did, peer_did=test_peer_did)
    
    recorder.record(
        category="message",
        function="make_thread_id",
        inputs={"my_did": test_owner_did, "peer_did": test_peer_did},
        outputs={"thread_id": thread_id},
        status="success"
    )
    
    store_message(
        conn=conn,
        msg_id=test_msg_id,
        thread_id=thread_id,
        direction=0,
        sender_did=test_peer_did,
        content=test_content,
        owner_did=test_owner_did,
        receiver_did=test_owner_did,
        content_type="text",
        credential_name=test_credential
    )
    
    recorder.record(
        category="message",
        function="store_message",
        inputs={
            "msg_id": test_msg_id,
            "owner_did": test_owner_did,
            "thread_id": thread_id,
            "direction": 0,
            "sender_did": test_peer_did,
            "content": test_content
        },
        outputs={"stored": True},
        status="success"
    )
    
    retrieved = get_message_by_id(
        conn=conn,
        msg_id=test_msg_id,
        owner_did=test_owner_did,
        credential_name=test_credential
    )
    
    recorder.record(
        category="message",
        function="get_message_by_id",
        inputs={
            "msg_id": test_msg_id,
            "owner_did": test_owner_did,
            "credential_name": test_credential
        },
        outputs={
            "found": retrieved is not None,
            "msg_id": retrieved.get("msg_id") if retrieved else None,
            "content": retrieved.get("content") if retrieved else None
        },
        status="success"
    )
    
    batch = [
        {
            "msg_id": "msg_batch_001",
            "thread_id": thread_id,
            "direction": 1,
            "sender_did": test_owner_did,
            "receiver_did": test_peer_did,
            "content_type": "text",
            "content": "批量消息 1",
            "sent_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "msg_id": "msg_batch_002",
            "thread_id": thread_id,
            "direction": 1,
            "sender_did": test_owner_did,
            "receiver_did": test_peer_did,
            "content_type": "text",
            "content": "批量消息 2",
            "sent_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    store_messages_batch(conn=conn, batch=batch, owner_did=test_owner_did, credential_name=test_credential)
    
    recorder.record(
        category="message",
        function="store_messages_batch",
        inputs={"batch_size": len(batch), "owner_did": test_owner_did, "credential_name": test_credential},
        outputs={"stored_count": len(batch)},
        status="success"
    )
    
    logger.info("消息操作函数测试完成")


def distill_contact_operations(recorder: DistillRecorder, conn: sqlite3.Connection):
    """蒸馏联系人操作函数。"""
    logger.info("测试联系人操作函数...")
    
    from local_store import ensure_schema, upsert_contact
    
    ensure_schema(conn)
    
    test_owner_did = "did:wba:awiki.ai:user:k1_test_owner"
    test_contact_did = "did:wba:awiki.ai:user:k1_test_contact"
    
    upsert_contact(
        conn=conn,
        owner_did=test_owner_did,
        did=test_contact_did,
        name="测试联系人",
        handle="@test_contact",
        nick_name="测试昵称",
        bio="测试简介",
        followed=True,
        messaged=False
    )
    
    recorder.record(
        category="contact",
        function="upsert_contact",
        inputs={
            "owner_did": test_owner_did,
            "did": test_contact_did,
            "name": "测试联系人",
            "handle": "@test_contact",
            "followed": True
        },
        outputs={"upserted": True},
        status="success"
    )
    
    row = conn.execute(
        "SELECT did, name, handle FROM contacts WHERE owner_did = ? AND did = ?",
        (test_owner_did, test_contact_did)
    ).fetchone()
    
    recorder.record(
        category="contact",
        function="upsert_contact (verify)",
        inputs={"owner_did": test_owner_did, "did": test_contact_did},
        outputs={
            "exists": row is not None,
            "name": row["name"] if row else None,
            "handle": row["handle"] if row else None
        },
        status="success"
    )
    
    logger.info("联系人操作函数测试完成")


def distill_relationship_event_operations(recorder: DistillRecorder, conn: sqlite3.Connection):
    """蒸馏关系事件操作函数。"""
    logger.info("测试关系事件操作函数...")
    
    from local_store import ensure_schema, append_relationship_event
    
    ensure_schema(conn)
    
    test_owner_did = "did:wba:awiki.ai:user:k1_test_owner"
    test_target_did = "did:wba:awiki.ai:user:k1_test_target"
    
    event_id = append_relationship_event(
        conn=conn,
        owner_did=test_owner_did,
        target_did=test_target_did,
        target_handle="@test_target",
        event_type="ai_recommended",
        reason="AI 推荐测试",
        score=0.95,
        status="pending",
        credential_name="distill_test"
    )
    
    recorder.record(
        category="relationship_event",
        function="append_relationship_event",
        inputs={
            "owner_did": test_owner_did,
            "target_did": test_target_did,
            "event_type": "ai_recommended",
            "score": 0.95
        },
        outputs={"event_id": event_id},
        status="success"
    )
    
    logger.info("关系事件操作函数测试完成")


def distill_group_operations(recorder: DistillRecorder, conn: sqlite3.Connection):
    """蒸馏群组操作函数。"""
    logger.info("测试群组操作函数...")
    
    from local_store import ensure_schema, upsert_group, upsert_group_member
    
    ensure_schema(conn)
    
    test_owner_did = "did:wba:awiki.ai:user:k1_test_owner"
    test_group_id = "group_distill_001"
    test_group_did = "did:wba:awiki.ai:group:k1_test_group"
    
    upsert_group(
        conn=conn,
        owner_did=test_owner_did,
        group_id=test_group_id,
        group_did=test_group_did,
        name="测试群组",
        slug="test-group",
        description="测试群组描述",
        membership_status="active",
        credential_name="distill_test"
    )
    
    recorder.record(
        category="group",
        function="upsert_group",
        inputs={
            "owner_did": test_owner_did,
            "group_id": test_group_id,
            "group_did": test_group_did,
            "name": "测试群组",
            "slug": "test-group"
        },
        outputs={"upserted": True},
        status="success"
    )
    
    test_member_did = "did:wba:awiki.ai:user:k1_test_member"
    upsert_group_member(
        conn=conn,
        owner_did=test_owner_did,
        group_id=test_group_id,
        user_id="user_001",
        member_did=test_member_did,
        member_handle="@test_member",
        role="member",
        status="active",
        credential_name="distill_test"
    )
    
    recorder.record(
        category="group",
        function="upsert_group_member",
        inputs={
            "owner_did": test_owner_did,
            "group_id": test_group_id,
            "user_id": "user_001",
            "member_did": test_member_did,
            "role": "member"
        },
        outputs={"upserted": True},
        status="success"
    )
    
    row = conn.execute(
        "SELECT group_id, name, slug FROM groups WHERE owner_did = ? AND group_id = ?",
        (test_owner_did, test_group_id)
    ).fetchone()
    
    recorder.record(
        category="group",
        function="upsert_group (verify)",
        inputs={"owner_did": test_owner_did, "group_id": test_group_id},
        outputs={
            "exists": row is not None,
            "name": row["name"] if row else None,
            "slug": row["slug"] if row else None
        },
        status="success"
    )
    
    logger.info("群组操作函数测试完成")


def distill_e2ee_outbox_operations(recorder: DistillRecorder, conn: sqlite3.Connection):
    """蒸馏 E2EE 发件箱操作函数。"""
    logger.info("测试 E2EE 发件箱操作函数...")
    
    from local_store import (
        ensure_schema, queue_e2ee_outbox, mark_e2ee_outbox_sent,
        list_e2ee_outbox, get_e2ee_outbox
    )
    
    ensure_schema(conn)
    
    test_owner_did = "did:wba:awiki.ai:user:k1_test_owner"
    test_peer_did = "did:wba:awiki.ai:user:k1_test_peer"
    test_plaintext = "E2EE 测试明文消息"
    test_credential = "distill_test"
    
    outbox_id = queue_e2ee_outbox(
        conn=conn,
        owner_did=test_owner_did,
        peer_did=test_peer_did,
        plaintext=test_plaintext,
        session_id="session_001",
        original_type="text",
        credential_name=test_credential
    )
    
    recorder.record(
        category="e2ee_outbox",
        function="queue_e2ee_outbox",
        inputs={
            "owner_did": test_owner_did,
            "peer_did": test_peer_did,
            "plaintext": test_plaintext,
            "session_id": "session_001",
            "original_type": "text"
        },
        outputs={"outbox_id": outbox_id},
        status="success"
    )
    
    outbox_record = get_e2ee_outbox(
        conn=conn,
        outbox_id=outbox_id,
        owner_did=test_owner_did,
        credential_name=test_credential
    )
    
    recorder.record(
        category="e2ee_outbox",
        function="get_e2ee_outbox",
        inputs={
            "outbox_id": outbox_id,
            "owner_did": test_owner_did,
            "credential_name": test_credential
        },
        outputs={
            "found": outbox_record is not None,
            "status": outbox_record.get("local_status") if outbox_record else None,
            "plaintext": outbox_record.get("plaintext") if outbox_record else None
        },
        status="success"
    )
    
    outbox_list = list_e2ee_outbox(
        conn=conn,
        owner_did=test_owner_did,
        credential_name=test_credential
    )
    
    recorder.record(
        category="e2ee_outbox",
        function="list_e2ee_outbox",
        inputs={"owner_did": test_owner_did, "credential_name": test_credential},
        outputs={"count": len(outbox_list)},
        status="success"
    )
    
    sent_msg_id = "sent_msg_001"
    mark_e2ee_outbox_sent(
        conn=conn,
        outbox_id=outbox_id,
        owner_did=test_owner_did,
        credential_name=test_credential,
        session_id="session_001",
        sent_msg_id=sent_msg_id,
        sent_server_seq=1,
        metadata=None
    )
    
    recorder.record(
        category="e2ee_outbox",
        function="mark_e2ee_outbox_sent",
        inputs={
            "outbox_id": outbox_id,
            "owner_did": test_owner_did,
            "sent_msg_id": sent_msg_id,
            "sent_server_seq": 1
        },
        outputs={"marked_sent": True},
        status="success"
    )
    
    logger.info("E2EE 发件箱操作函数测试完成")


def distill_normalization_functions(recorder: DistillRecorder):
    """蒸馏规范化函数。"""
    logger.info("测试规范化函数...")
    
    from local_store import (
        _normalize_credential_name,
        _normalize_owner_did,
        _normalize_optional_text,
        _normalize_optional_int,
        _normalize_optional_bool,
        _normalize_optional_float,
        _normalize_metadata
    )
    
    recorder.record(
        category="normalization",
        function="_normalize_credential_name",
        inputs={"credential_name": None},
        outputs={"result": _normalize_credential_name(None)},
        status="success"
    )
    
    recorder.record(
        category="normalization",
        function="_normalize_credential_name",
        inputs={"credential_name": "test_cred"},
        outputs={"result": _normalize_credential_name("test_cred")},
        status="success"
    )
    
    recorder.record(
        category="normalization",
        function="_normalize_owner_did",
        inputs={"owner_did": None},
        outputs={"result": _normalize_owner_did(None)},
        status="success"
    )
    
    recorder.record(
        category="normalization",
        function="_normalize_owner_did",
        inputs={"owner_did": "did:wba:test"},
        outputs={"result": _normalize_owner_did("did:wba:test")},
        status="success"
    )
    
    recorder.record(
        category="normalization",
        function="_normalize_optional_text",
        inputs={"value": None},
        outputs={"result": _normalize_optional_text(None)},
        status="success"
    )
    
    recorder.record(
        category="normalization",
        function="_normalize_optional_text",
        inputs={"value": "test"},
        outputs={"result": _normalize_optional_text("test")},
        status="success"
    )
    
    recorder.record(
        category="normalization",
        function="_normalize_optional_int",
        inputs={"value": None},
        outputs={"result": _normalize_optional_int(None)},
        status="success"
    )
    
    recorder.record(
        category="normalization",
        function="_normalize_optional_int",
        inputs={"value": "42"},
        outputs={"result": _normalize_optional_int("42")},
        status="success"
    )
    
    recorder.record(
        category="normalization",
        function="_normalize_optional_bool",
        inputs={"value": None},
        outputs={"result": _normalize_optional_bool(None)},
        status="success"
    )
    
    recorder.record(
        category="normalization",
        function="_normalize_optional_bool",
        inputs={"value": True},
        outputs={"result": _normalize_optional_bool(True)},
        status="success"
    )
    
    recorder.record(
        category="normalization",
        function="_normalize_optional_float",
        inputs={"value": None},
        outputs={"result": _normalize_optional_float(None)},
        status="success"
    )
    
    recorder.record(
        category="normalization",
        function="_normalize_optional_float",
        inputs={"value": "3.14"},
        outputs={"result": _normalize_optional_float("3.14")},
        status="success"
    )
    
    recorder.record(
        category="normalization",
        function="_normalize_metadata",
        inputs={"value": None},
        outputs={"result": _normalize_metadata(None)},
        status="success"
    )
    
    recorder.record(
        category="normalization",
        function="_normalize_metadata",
        inputs={"value": {"key": "value"}},
        outputs={"result": _normalize_metadata({"key": "value"})},
        status="success"
    )
    
    recorder.record(
        category="normalization",
        function="_normalize_metadata",
        inputs={"value": '{"existing": "json"}'},
        outputs={"result": _normalize_metadata('{"existing": "json"}')},
        status="success"
    )
    
    logger.info("规范化函数测试完成")


def distill_thread_id_generation(recorder: DistillRecorder):
    """蒸馏线程 ID 生成函数。"""
    logger.info("测试线程 ID 生成函数...")
    
    from local_store import make_thread_id
    
    dm_thread = make_thread_id(
        my_did="did:wba:awiki.ai:user:k1_owner",
        peer_did="did:wba:awiki.ai:user:k1_peer"
    )
    
    recorder.record(
        category="thread_id",
        function="make_thread_id (DM)",
        inputs={
            "my_did": "did:wba:awiki.ai:user:k1_owner",
            "peer_did": "did:wba:awiki.ai:user:k1_peer"
        },
        outputs={"thread_id": dm_thread},
        status="success"
    )
    
    group_thread = make_thread_id(
        my_did="did:wba:awiki.ai:user:k1_owner",
        group_id="group_001"
    )
    
    recorder.record(
        category="thread_id",
        function="make_thread_id (group)",
        inputs={
            "my_did": "did:wba:awiki.ai:user:k1_owner",
            "group_id": "group_001"
        },
        outputs={"thread_id": group_thread},
        status="success"
    )
    
    logger.info("线程 ID 生成函数测试完成")


# ============================================================================
# 主函数
# ============================================================================

def main():
    """执行蒸馏脚本。"""
    logger.info("=" * 60)
    logger.info("开始执行 local_store.py 蒸馏脚本")
    logger.info("=" * 60)
    
    with tempfile.TemporaryDirectory() as temp_dir:
        db_path = os.path.join(temp_dir, "distill_test.db")
        output_path = os.path.join(temp_dir, "distill_output.json")
        
        logger.info(f"创建临时数据库：{db_path}")
        
        conn = create_test_connection(db_path)
        recorder = DistillRecorder(output_path)
        
        try:
            distill_normalization_functions(recorder)
            distill_thread_id_generation(recorder)
            distill_schema_operations(recorder, conn)
            distill_message_operations(recorder, conn)
            distill_contact_operations(recorder, conn)
            distill_relationship_event_operations(recorder, conn)
            distill_group_operations(recorder, conn)
            distill_e2ee_outbox_operations(recorder, conn)
            
            recorder.save()
            
            print("\n" + "=" * 60)
            print("蒸馏完成!")
            print("=" * 60)
            print(f"总记录数：{len(recorder.records)}")
            print(f"输出文件：{output_path}")
            print("\n记录分类统计:")
            
            categories = {}
            for record in recorder.records:
                cat = record["category"]
                categories[cat] = categories.get(cat, 0) + 1
            
            for cat, count in sorted(categories.items()):
                print(f"  - {cat}: {count}")
            
            print("=" * 60)
            
            return 0
            
        except Exception as e:
            logger.error(f"蒸馏执行失败：{e}", exc_info=True)
            print(f"\n错误：{e}")
            return 1
        
        finally:
            conn.close()


if __name__ == "__main__":
    sys.exit(main())
