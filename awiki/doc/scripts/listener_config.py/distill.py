#!/usr/bin/env python
"""Distiller for listener_config.py - records golden standard inputs/outputs.

This script executes listener_config.py and captures:
- Input: Configuration loading parameters
- Output: ListenerConfig instances with all fields

Usage:
    python distill.py
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# Add python/scripts to path for imports
SCRIPTS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "python" / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent / "python"))


def test_default_config():
    """Test 1: Load default configuration."""
    print("=" * 60)
    print("TEST 1: Default Configuration")
    print("=" * 60)
    
    from listener_config import ListenerConfig, ROUTING_MODES, RoutingRules
    
    # Input: No parameters (use defaults)
    input_params = {"config_path": None, "mode_override": None}
    print(f"[INPUT] {json.dumps(input_params, indent=2)}")
    
    # Execute
    config = ListenerConfig.load()
    
    # Output: Capture all fields
    output = {
        "mode": config.mode,
        "agent_webhook_url": config.agent_webhook_url,
        "wake_webhook_url": config.wake_webhook_url,
        "webhook_token": config.webhook_token,
        "agent_hook_name": config.agent_hook_name,
        "routing": {
            "whitelist_dids": list(config.routing.whitelist_dids),
            "private_always_agent": config.routing.private_always_agent,
            "command_prefix": config.routing.command_prefix,
            "keywords": list(config.routing.keywords),
            "bot_names": list(config.routing.bot_names),
            "blacklist_dids": list(config.routing.blacklist_dids),
        },
        "ignore_types": list(config.ignore_types),
        "e2ee_save_interval": config.e2ee_save_interval,
        "e2ee_decrypt_fail_action": config.e2ee_decrypt_fail_action,
        "reconnect_base_delay": config.reconnect_base_delay,
        "reconnect_max_delay": config.reconnect_max_delay,
        "heartbeat_interval": config.heartbeat_interval,
    }
    print(f"[OUTPUT] {json.dumps(output, indent=2)}")
    
    # Verify
    assert config.mode == "smart", f"Expected mode='smart', got {config.mode!r}"
    assert config.mode in ROUTING_MODES, f"Mode {config.mode!r} not in ROUTING_MODES"
    assert config.routing.command_prefix == "/", f"Expected command_prefix='/', got {config.routing.command_prefix!r}"
    
    print("[PASS] Default configuration test passed\n")
    return True


def test_mode_override():
    """Test 2: Load with mode override."""
    print("=" * 60)
    print("TEST 2: Mode Override")
    print("=" * 60)
    
    from listener_config import ListenerConfig, ROUTING_MODES
    
    # Input: Override mode to agent-all
    input_params = {"config_path": None, "mode_override": "agent-all"}
    print(f"[INPUT] {json.dumps(input_params, indent=2)}")
    
    # Execute
    config = ListenerConfig.load(mode_override="agent-all")
    
    # Output
    output = {"mode": config.mode}
    print(f"[OUTPUT] {json.dumps(output, indent=2)}")
    
    # Verify
    assert config.mode == "agent-all", f"Expected mode='agent-all', got {config.mode!r}"
    
    print("[PASS] Mode override test passed\n")
    return True


def test_routing_rules():
    """Test 3: Test RoutingRules dataclass."""
    print("=" * 60)
    print("TEST 3: RoutingRules")
    print("=" * 60)
    
    from listener_config import RoutingRules
    
    # Input: Custom routing rules
    input_params = {
        "whitelist_dids": ["did:example:123"],
        "private_always_agent": False,
        "command_prefix": "!",
        "keywords": ("important", "priority"),
        "bot_names": ("Bot1", "Bot2"),
    }
    print(f"[INPUT] {json.dumps(input_params, indent=2)}")
    
    # Execute
    rules = RoutingRules(
        whitelist_dids=frozenset(input_params["whitelist_dids"]),
        private_always_agent=input_params["private_always_agent"],
        command_prefix=input_params["command_prefix"],
        keywords=input_params["keywords"],
        bot_names=input_params["bot_names"],
    )
    
    # Output
    output = {
        "whitelist_dids": list(rules.whitelist_dids),
        "private_always_agent": rules.private_always_agent,
        "command_prefix": rules.command_prefix,
        "keywords": list(rules.keywords),
        "bot_names": list(rules.bot_names),
        "blacklist_dids": list(rules.blacklist_dids),
    }
    print(f"[OUTPUT] {json.dumps(output, indent=2)}")
    
    # Verify
    assert "did:example:123" in rules.whitelist_dids
    assert rules.command_prefix == "!"
    assert "important" in rules.keywords
    
    print("[PASS] RoutingRules test passed\n")
    return True


def test_invalid_mode():
    """Test 4: Test invalid mode validation."""
    print("=" * 60)
    print("TEST 4: Invalid Mode Validation")
    print("=" * 60)
    
    from listener_config import ListenerConfig
    
    # Input: Invalid mode
    input_params = {"mode": "invalid-mode"}
    print(f"[INPUT] {json.dumps(input_params, indent=2)}")
    
    # Execute & Verify
    try:
        config = ListenerConfig(mode="invalid-mode")
        print("[OUTPUT] No exception raised (UNEXPECTED)")
        print("[FAIL] Should have raised ValueError for invalid mode\n")
        return False
    except ValueError as e:
        output = {"exception": "ValueError", "message": str(e)}
        print(f"[OUTPUT] {json.dumps(output, indent=2)}")
        print("[PASS] Invalid mode validation test passed\n")
        return True


def test_constants():
    """Test 5: Test ROUTING_MODES constant."""
    print("=" * 60)
    print("TEST 5: ROUTING_MODES Constant")
    print("=" * 60)
    
    from listener_config import ROUTING_MODES
    
    # Input: None (testing constant)
    input_params = {}
    print(f"[INPUT] {json.dumps(input_params, indent=2)}")
    
    # Output
    output = {"ROUTING_MODES": list(ROUTING_MODES)}
    print(f"[OUTPUT] {json.dumps(output, indent=2)}")
    
    # Verify
    assert isinstance(ROUTING_MODES, tuple)
    assert "agent-all" in ROUTING_MODES
    assert "smart" in ROUTING_MODES
    assert "wake-all" in ROUTING_MODES
    
    print("[PASS] ROUTING_MODES test passed\n")
    return True


def main():
    """Run all distillation tests."""
    print("\n" + "=" * 60)
    print("DISTILLER: listener_config.py")
    print("Golden Standard Input/Output Recording")
    print("=" * 60 + "\n")
    
    results = []
    
    # Run all tests
    tests = [
        ("Default Config", test_default_config),
        ("Mode Override", test_mode_override),
        ("RoutingRules", test_routing_rules),
        ("Invalid Mode Validation", test_invalid_mode),
        ("ROUTING_MODES", test_constants),
    ]
    
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, "PASS" if result else "FAIL"))
        except Exception as e:
            logger.exception(f"Test {name} failed with exception")
            results.append((name, f"ERROR: {e}"))
    
    # Summary
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for name, status in results:
        print(f"  {name}: {status}")
    
    passed = sum(1 for _, s in results if s == "PASS")
    total = len(results)
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n[DISTILL COMPLETE] All tests passed - golden standard recorded")
        return 0
    else:
        print("\n[DISTILL FAILED] Some tests failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
