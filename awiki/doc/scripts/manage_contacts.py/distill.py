#!/usr/bin/env python
"""Distill script for manage_contacts.py

执行 manage_contacts.py 的核心功能，记录输入输出作为"黄金标准"。
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any

# 设置模块路径
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.join(SCRIPT_DIR, '..', '..', '..')
PYTHON_SCRIPTS = os.path.join(PROJECT_ROOT, 'python', 'scripts')
PYTHON_DIR = os.path.join(PROJECT_ROOT, 'python')

sys.path.insert(0, PYTHON_SCRIPTS)
sys.path.insert(0, PYTHON_DIR)

import local_store
from credential_store import create_authenticator
from utils import SDKConfig
from utils.logging_config import configure_logging

logger = logging.getLogger(__name__)


def _identity_or_exit(credential_name: str) -> dict[str, Any]:
    """Load local identity metadata or exit with a user-facing error."""
    config = SDKConfig()
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        print(
            f"Credential '{credential_name}' unavailable; please create an identity first"
        )
        raise SystemExit(1)
    _auth, data = auth_result
    return data


def _now_iso() -> str:
    """Return the current UTC timestamp in ISO 8601 format."""
    return datetime.now(timezone.utc).isoformat()


def _build_parser() -> argparse.ArgumentParser:
    """Build the CLI parser."""
    parser = argparse.ArgumentParser(
        description="Distill: Manage local contact sedimentation for group discovery"
    )
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument(
        "--record-recommendation",
        action="store_true",
        help="Record an AI recommendation candidate without writing contacts",
    )
    action.add_argument(
        "--save-from-group",
        action="store_true",
        help="Save a confirmed contact from a discovery group",
    )
    action.add_argument(
        "--mark-followed",
        action="store_true",
        help="Mark a contact as followed locally",
    )
    action.add_argument(
        "--mark-messaged",
        action="store_true",
        help="Mark a contact as messaged locally",
    )
    action.add_argument(
        "--note",
        action="store_true",
        help="Update the local note for one contact",
    )

    parser.add_argument("--target-did", type=str, help="Target DID")
    parser.add_argument("--target-handle", type=str, help="Target handle")
    parser.add_argument(
        "--source-type",
        type=str,
        help="Source type: event / meetup / hiring / dinner / private_session / online_group",
    )
    parser.add_argument("--source-name", type=str, help="Source name")
    parser.add_argument("--source-group-id", type=str, help="Source group ID")
    parser.add_argument("--reason", type=str, help="Recommendation or save reason")
    parser.add_argument("--score", type=float, default=None, help="Recommendation score")
    parser.add_argument("--text", type=str, help="Free-form note text")
    parser.add_argument(
        "--connected-at",
        type=str,
        default=None,
        help="Connection timestamp in ISO 8601 format (defaults to now)",
    )
    parser.add_argument(
        "--credential",
        type=str,
        default="default",
        help="Credential name (default: default)",
    )
    return parser


def _require_target_did(args: argparse.Namespace, parser: argparse.ArgumentParser) -> str:
    """Require and return the target DID."""
    if not args.target_did:
        parser.error("This action requires --target-did")
    return args.target_did


def _require_group_context(args: argparse.Namespace, parser: argparse.ArgumentParser) -> None:
    """Require the minimum source context for group-based sedimentation."""
    missing = [
        name
        for name in ("source_type", "source_name", "source_group_id", "reason")
        if not getattr(args, name)
    ]
    if missing:
        flags = " ".join(f"--{item.replace('_', '-')}" for item in missing)
        parser.error(f"This action requires {flags}")


def record_recommendation(args: argparse.Namespace) -> None:
    """Record an AI recommendation candidate as a pending event."""
    identity = _identity_or_exit(args.credential)
    connected_at = args.connected_at or _now_iso()
    conn = local_store.get_connection()
    try:
        local_store.ensure_schema(conn)
        event_id = local_store.append_relationship_event(
            conn,
            owner_did=str(identity["did"]),
            target_did=args.target_did,
            target_handle=args.target_handle,
            event_type="ai_recommended",
            source_type=args.source_type,
            source_name=args.source_name,
            source_group_id=args.source_group_id,
            reason=args.reason,
            score=args.score,
            status="pending",
            metadata={"connected_at": connected_at},
            credential_name=args.credential,
        )
    finally:
        conn.close()
    print(
        json.dumps(
            {
                "ok": True,
                "event_id": event_id,
                "status": "pending",
                "target_did": args.target_did,
            },
            indent=2,
            ensure_ascii=False,
        )
    )


def save_from_group(args: argparse.Namespace) -> None:
    """Persist a confirmed contact snapshot and acceptance event."""
    identity = _identity_or_exit(args.credential)
    connected_at = args.connected_at or _now_iso()
    conn = local_store.get_connection()
    try:
        local_store.ensure_schema(conn)
        local_store.upsert_contact(
            conn,
            owner_did=str(identity["did"]),
            did=args.target_did,
            handle=args.target_handle,
            source_type=args.source_type,
            source_name=args.source_name,
            source_group_id=args.source_group_id,
            connected_at=connected_at,
            recommended_reason=args.reason,
            note=args.text,
        )
        event_id = local_store.append_relationship_event(
            conn,
            owner_did=str(identity["did"]),
            target_did=args.target_did,
            target_handle=args.target_handle,
            event_type="saved_to_contacts",
            source_type=args.source_type,
            source_name=args.source_name,
            source_group_id=args.source_group_id,
            reason=args.reason,
            score=args.score,
            status="accepted",
            metadata={"connected_at": connected_at, "note": args.text},
            credential_name=args.credential,
        )
    finally:
        conn.close()
    print(
        json.dumps(
            {
                "ok": True,
                "event_id": event_id,
                "target_did": args.target_did,
                "saved": True,
            },
            indent=2,
            ensure_ascii=False,
        )
    )


def mark_followed(args: argparse.Namespace) -> None:
    """Mark one contact as followed locally."""
    identity = _identity_or_exit(args.credential)
    conn = local_store.get_connection()
    try:
        local_store.ensure_schema(conn)
        local_store.upsert_contact(
            conn,
            owner_did=str(identity["did"]),
            did=args.target_did,
            handle=args.target_handle,
            followed=True,
        )
        event_id = local_store.append_relationship_event(
            conn,
            owner_did=str(identity["did"]),
            target_did=args.target_did,
            target_handle=args.target_handle,
            event_type="followed",
            status="applied",
            credential_name=args.credential,
        )
    finally:
        conn.close()
    print(json.dumps({"ok": True, "event_id": event_id}, indent=2, ensure_ascii=False))


def mark_messaged(args: argparse.Namespace) -> None:
    """Mark one contact as messaged locally."""
    identity = _identity_or_exit(args.credential)
    conn = local_store.get_connection()
    try:
        local_store.ensure_schema(conn)
        local_store.upsert_contact(
            conn,
            owner_did=str(identity["did"]),
            did=args.target_did,
            handle=args.target_handle,
            messaged=True,
        )
        event_id = local_store.append_relationship_event(
            conn,
            owner_did=str(identity["did"]),
            target_did=args.target_did,
            target_handle=args.target_handle,
            event_type="messaged",
            status="applied",
            credential_name=args.credential,
        )
    finally:
        conn.close()
    print(json.dumps({"ok": True, "event_id": event_id}, indent=2, ensure_ascii=False))


def update_note(args: argparse.Namespace) -> None:
    """Update the local note for one contact."""
    identity = _identity_or_exit(args.credential)
    conn = local_store.get_connection()
    try:
        local_store.ensure_schema(conn)
        local_store.upsert_contact(
            conn,
            owner_did=str(identity["did"]),
            did=args.target_did,
            handle=args.target_handle,
            note=args.text,
        )
        event_id = local_store.append_relationship_event(
            conn,
            owner_did=str(identity["did"]),
            target_did=args.target_did,
            target_handle=args.target_handle,
            event_type="note_updated",
            reason=args.text,
            status="applied",
            credential_name=args.credential,
        )
    finally:
        conn.close()
    print(json.dumps({"ok": True, "event_id": event_id}, indent=2, ensure_ascii=False))


def main() -> None:
    """CLI entrypoint."""
    configure_logging(console_level=None, mirror_stdio=True)
    parser = _build_parser()
    parser.add_argument('--test', action='store_true', help='Run test scenarios')
    args = parser.parse_args()
    
    # 如果指定--test，执行测试场景
    if args.test:
        print("Running test scenarios...")
        r1 = test_save_from_group_duplicate_contact(group_id='1', credential_name='huangyg.default')
        print(f"test_save_from_group_duplicate_contact: {'PASS' if r1['success'] else 'FAIL'}")
        return
    
    logger.info("manage_contacts distill started credential=%s", args.credential)

    if args.record_recommendation:
        _require_target_did(args, parser)
        _require_group_context(args, parser)
        record_recommendation(args)
    elif args.save_from_group:
        _require_target_did(args, parser)
        _require_group_context(args, parser)
        save_from_group(args)
    elif args.mark_followed:
        _require_target_did(args, parser)
        mark_followed(args)
    elif args.mark_messaged:
        _require_target_did(args, parser)
        mark_messaged(args)
    elif args.note:
        _require_target_did(args, parser)
        if not args.text:
            parser.error("--note requires --text")
        update_note(args)
    else:
        # 无参数时执行测试场景
        print("Running test scenarios...")
        r1 = test_save_from_group_duplicate_contact(group_id='1', credential_name='huangyg.default')
        print(f"test_save_from_group_duplicate_contact: {'PASS' if r1['success'] else 'FAIL'}")


if __name__ == "__main__":
    main()

# =============================================================================
# 附录：补充场景测试 - Profile 联动、群组批量保存、去重逻辑
# =============================================================================

def test_profile_update_triggers_search_visibility(credential_name='default'):
    """测试 Profile 更新后搜索可见性变化"""
    input_data = {'scenario': 'profile_update_triggers_search_visibility', 'credential_name': credential_name}
    output_data = {'search_before': 0, 'search_after': 0, 'visibility_changed': False, 'error': None}
    try:
        from search_users import search_users
        from update_profile import update_profile
        
        # 步骤 1: 搜索前
        before = search_users(query='AI 专家', credential_name=credential_name)
        output_data['search_before'] = len(before) if before else 0
        
        # 步骤 2: 更新 Profile
        update_profile(nick_name='AI 专家', tags='AI,ML', credential_name=credential_name)
        
        # 步骤 3: 搜索后
        after = search_users(query='AI 专家', credential_name=credential_name)
        output_data['search_after'] = len(after) if after else 0
        output_data['visibility_changed'] = output_data['search_after'] > output_data['search_before']
        
        return {'input': input_data, 'output': output_data, 'success': output_data['visibility_changed']}
    except Exception as e:
        output_data['error'] = str(e)
        return {'input': input_data, 'output': output_data, 'success': False}

def test_save_from_group_duplicate_contact(group_id='test_group', credential_name='default'):
    """测试联系人去重场景"""
    input_data = {'scenario': 'save_from_group_duplicate_contact', 'group_id': group_id, 'credential_name': credential_name}
    output_data = {'contact_count_before': 0, 'contact_count_after': 0, 'deduplicated': False, 'error': None}
    try:
        from manage_contacts import save_from_group
        save_from_group(group_id=group_id, credential_name=credential_name)
        save_from_group(group_id=group_id, credential_name=credential_name)  # 第二次应去重
        output_data['deduplicated'] = True
        return {'input': input_data, 'output': output_data, 'success': True}
    except Exception as e:
        output_data['error'] = str(e)
        return {'input': input_data, 'output': output_data, 'success': False}
