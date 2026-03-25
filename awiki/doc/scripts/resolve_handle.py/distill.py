"""Distill script for resolve_handle.py - records golden standard I/O.

This script executes the resolve_handle module and captures input/output
pairs as golden standards for testing and validation.
"""

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

# Add python/scripts to path for imports (where utils package lives)
script_dir = Path(__file__).parent
project_root = script_dir.parent.parent.parent
python_scripts = project_root / "python" / "scripts"
sys.path.insert(0, str(python_scripts))

from utils.logging_config import configure_logging

logger = logging.getLogger(__name__)


async def distill_resolve(handle: str | None, did: str | None) -> dict:
    """Execute resolve_handle logic and capture I/O."""
    logger.info("Distilling: handle=%s did=%s", handle, did)
    
    from utils import SDKConfig, create_user_service_client, resolve_handle, lookup_handle
    
    config = SDKConfig()
    
    async with create_user_service_client(config) as client:
        if handle:
            print(f"[INPUT] Resolving handle: {handle}")
            result = await resolve_handle(client, handle)
        elif did:
            print(f"[INPUT] Looking up handle for DID: {did}")
            result = await lookup_handle(client, did)
        else:
            print("[INPUT] No handle or DID provided")
            return {"error": "Either handle or did is required"}
    
    print(f"[OUTPUT] {json.dumps(result, indent=2, ensure_ascii=False)}")
    return result


def run_distill_tests() -> None:
    """Run distillation tests with sample inputs."""
    configure_logging(console_level=logging.INFO, mirror_stdio=True)
    
    print("=" * 60)
    print("DISTILL: resolve_handle.py - Golden Standard I/O")
    print("=" * 60)
    
    test_cases = [
        {"handle": "alice", "did": None, "desc": "Resolve handle to DID"},
        {"handle": None, "did": "did:wba:awiki.ai:user:k1_test", "desc": "Lookup handle by DID"},
    ]
    
    for i, case in enumerate(test_cases, 1):
        print(f"\n--- Test Case {i}: {case['desc']} ---")
        try:
            result = asyncio.run(distill_resolve(case["handle"], case["did"]))
            print(f"[STATUS] Success")
        except Exception as e:
            print(f"[STATUS] Error: {e}")
            result = {"error": str(e)}
        
        # Record golden standard
        print(f"[GOLDEN] Input: handle={case['handle']}, did={case['did']}")
        print(f"[GOLDEN] Output: {json.dumps(result, ensure_ascii=False)}")
    
    print("\n" + "=" * 60)
    print("DISTILL COMPLETE")
    print("=" * 60)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Distill resolve_handle.py - record golden standard I/O"
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Run distillation tests with sample inputs"
    )
    parser.add_argument(
        "--handle",
        type=str,
        help="Handle to resolve"
    )
    parser.add_argument(
        "--did",
        type=str,
        help="DID to look up"
    )
    
    args = parser.parse_args()
    
    configure_logging(console_level=logging.INFO, mirror_stdio=True)
    
    if args.test or (not args.handle and not args.did):
        run_distill_tests()
    else:
        asyncio.run(distill_resolve(args.handle, args.did))


if __name__ == "__main__":
    main()
