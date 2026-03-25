#!/usr/bin/env python3
"""Distill script for ws_listener.py - records input/output as golden standard.

This script executes key functions from ws_listener.py and logs the results.
"""

from __future__ import annotations

import json
import logging
import sys
import os
from typing import Any

# Add python/scripts/ to path for imports
_base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
_scripts_dir = os.path.join(_base_dir, "python", "scripts")
_utils_dir = os.path.join(_base_dir, "python")

for d in [_scripts_dir, _utils_dir]:
    if d not in sys.path:
        sys.path.insert(0, d)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("distill")

# Import target module
from ws_listener import (
    _truncate_did,
    _is_reserved_e2ee_type,
    classify_message,
    _build_identity,
)
from listener_config import ListenerConfig, RoutingRules


def log_result(func_name: str, inputs: dict[str, Any], output: Any) -> None:
    """Log function execution result."""
    print("=" * 60)
    print(f"FUNCTION: {func_name}")
    print(f"INPUT: {json.dumps(inputs, default=str, ensure_ascii=False)}")
    print(f"OUTPUT: {json.dumps(output, default=str, ensure_ascii=False)}")
    print("=" * 60)


def test_truncate_did() -> None:
    """Test _truncate_did function."""
    logger.info("Testing _truncate_did...")
    
    test_cases = [
        "did:wba:awiki.ai:user:k1_AB8G0We3oboQNZldVTWdfTyqSrwQPV7QSCSeP3P8O1g",
        "short",
        "did:wba:awiki.ai:user:k1_mSDgXJ_LIWEJ_jWrxVCqdWPNuMr1EIVYV7o8yg_zp5w",
    ]
    
    for did in test_cases:
        result = _truncate_did(did)
        log_result("_truncate_did", {"did": did}, result)


def test_is_reserved_e2ee_type() -> None:
    """Test _is_reserved_e2ee_type function."""
    logger.info("Testing _is_reserved_e2ee_type...")
    
    test_cases = [
        "e2ee",
        "e2ee_msg",
        "e2ee_request",
        "group_e2ee_msg",
        "group_e2ee_request",
        "group_epoch_advance",
        "text",
        "image",
        "file",
    ]
    
    for msg_type in test_cases:
        result = _is_reserved_e2ee_type(msg_type)
        log_result("_is_reserved_e2ee_type", {"msg_type": msg_type}, result)


def test_classify_message() -> None:
    """Test classify_message function."""
    logger.info("Testing classify_message...")
    
    my_did = "did:wba:awiki.ai:user:k1_AB8G0We3oboQNZldVTWdfTyqSrwQPV7QSCSeP3P8O1g"
    
    # Create config with proper RoutingRules
    routing = RoutingRules(
        whitelist_dids=frozenset([]),
        blacklist_dids=frozenset(["did:wba:awiki.ai:user:k1_bad"]),
        private_always_agent=False,
        command_prefix="/",
        bot_names=(),
        keywords=("urgent", "approval", "payment", "alert"),
    )
    
    cfg = ListenerConfig(
        mode="smart",
        agent_webhook_url="http://127.0.0.1:18789/hooks/agent",
        wake_webhook_url="http://127.0.0.1:18789/hooks/wake",
        webhook_token="",
        routing=routing,
    )
    
    test_cases = [
        {
            "name": "Self message (should drop)",
            "params": {
                "sender_did": my_did,
                "content": "Hello",
                "type": "text",
            },
        },
        {
            "name": "Normal message (wake mode)",
            "params": {
                "sender_did": "did:wba:awiki.ai:user:k1_other",
                "content": "Hello there",
                "type": "text",
            },
        },
        {
            "name": "Command message (agent mode)",
            "params": {
                "sender_did": "did:wba:awiki.ai:user:k1_other",
                "content": "/help",
                "type": "text",
            },
        },
        {
            "name": "E2EE message (should drop)",
            "params": {
                "sender_did": "did:wba:awiki.ai:user:k1_other",
                "content": "encrypted",
                "type": "e2ee_msg",
            },
        },
        {
            "name": "Blacklisted sender (should drop)",
            "params": {
                "sender_did": "did:wba:awiki.ai:user:k1_bad",
                "content": "Hello",
                "type": "text",
            },
        },
        {
            "name": "Keyword message (agent mode)",
            "params": {
                "sender_did": "did:wba:awiki.ai:user:k1_other",
                "content": "This is urgent!",
                "type": "text",
            },
        },
    ]
    
    # Test with smart config
    for case in test_cases:
        result = classify_message(case["params"], my_did, cfg)
        log_result(f"classify_message ({case['name']})", {
            "params": case["params"],
            "my_did": my_did,
            "cfg.mode": cfg.mode,
        }, result)
    
    # Test agent-all mode
    cfg = ListenerConfig(
        mode="agent-all",
        agent_webhook_url="http://127.0.0.1:18789/hooks/agent",
        wake_webhook_url="http://127.0.0.1:18789/hooks/wake",
        webhook_token="",
        routing=routing,
    )
    result = classify_message({
        "sender_did": "did:wba:awiki.ai:user:k1_other",
        "content": "Hello",
        "type": "text",
    }, my_did, cfg)
    log_result("classify_message (agent-all mode)", {
        "params": {"sender_did": "did:wba:awiki.ai:user:k1_other", "content": "Hello"},
        "cfg.mode": "agent-all",
    }, result)
    
    # Test wake-all mode
    cfg = ListenerConfig(
        mode="wake-all",
        agent_webhook_url="http://127.0.0.1:18789/hooks/agent",
        wake_webhook_url="http://127.0.0.1:18789/hooks/wake",
        webhook_token="",
        routing=routing,
    )
    result = classify_message({
        "sender_did": "did:wba:awiki.ai:user:k1_other",
        "content": "Hello",
        "type": "text",
    }, my_did, cfg)
    log_result("classify_message (wake-all mode)", {
        "params": {"sender_did": "did:wba:awiki.ai:user:k1_other", "content": "Hello"},
        "cfg.mode": "wake-all",
    }, result)


def test_build_identity() -> None:
    """Test _build_identity function."""
    logger.info("Testing _build_identity...")
    
    # Mock credential data
    cred_data = {
        "did": "did:wba:awiki.ai:user:k1_AB8G0We3oboQNZldVTWdfTyqSrwQPV7QSCSeP3P8O1g",
        "private_key_pem": "-----BEGIN EC PRIVATE KEY-----\nmock\n-----END EC PRIVATE KEY-----",
        "public_key_pem": "-----BEGIN PUBLIC KEY-----\nmock\n-----END PUBLIC KEY-----",
        "did_document": {"id": "did:wba:awiki.ai:user:k1_mock"},
        "user_id": "77ec3f44-f94f-4c19-b315-49c0f0bf4a37",
        "jwt_token": "mock.jwt.token",
    }
    
    try:
        identity = _build_identity(cred_data)
        log_result("_build_identity", {
            "did": cred_data["did"],
            "user_id": cred_data["user_id"],
        }, {
            "did": identity.did,
            "user_id": identity.user_id,
            "has_jwt": bool(identity.jwt_token),
            "has_private_key": bool(identity.private_key_pem),
        })
    except Exception as e:
        log_result("_build_identity", {"cred_data": "mock"}, {"error": str(e)})


def main() -> None:
    """Run all distillation tests."""
    print("=" * 60)
    print("WS_LISTENER.PY DISTILLATION SCRIPT")
    print("=" * 60)
    
    try:
        test_truncate_did()
        test_is_reserved_e2ee_type()
        test_classify_message()
        test_build_identity()
        
        print("\n" + "=" * 60)
        print("DISTILLATION COMPLETE - ALL TESTS PASSED")
        print("=" * 60)
    except Exception as e:
        logger.error(f"Distillation failed: {e}")
        raise


if __name__ == "__main__":
    main()
