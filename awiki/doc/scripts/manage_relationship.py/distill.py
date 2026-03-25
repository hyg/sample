"""Distill script for manage_relationship.py - Records golden standard I/O.

This script documents the input/output behavior of manage_relationship.py
as a golden standard for testing and reference.
"""

import json
import sys

# =============================================================================
# Golden Standard: manage_relationship.py I/O Documentation
# =============================================================================

SCRIPT_PATH = "python/scripts/manage_relationship.py"
RPC_ENDPOINT = "/user-service/did/relationships/rpc"

# -----------------------------------------------------------------------------
# Input: CLI Arguments (Mutually Exclusive Group)
# -----------------------------------------------------------------------------

CLI_INPUTS = {
    "follow": {
        "argument": "--follow <DID_or_handle>",
        "example": '--follow "did:wba:localhost:user:abc123"',
        "description": "Follow a specific DID",
    },
    "unfollow": {
        "argument": "--unfollow <DID_or_handle>",
        "example": '--unfollow "did:wba:localhost:user:abc123"',
        "description": "Unfollow a specific DID",
    },
    "status": {
        "argument": "--status <DID_or_handle>",
        "example": '--status "did:wba:localhost:user:abc123"',
        "description": "View relationship status with a specific DID",
    },
    "following": {
        "argument": "--following",
        "example": "--following",
        "description": "View following list",
    },
    "followers": {
        "argument": "--followers",
        "example": "--followers",
        "description": "View followers list",
    },
}

# Optional arguments
OPTIONAL_ARGS = {
    "--credential": {"default": "default", "description": "Credential name"},
    "--limit": {"default": 50, "description": "List result count"},
    "--offset": {"default": 0, "description": "List offset"},
}

# -----------------------------------------------------------------------------
# Input: Module Dependencies
# -----------------------------------------------------------------------------

MODULE_INPUTS = {
    "utils": ["SDKConfig", "create_user_service_client", "authenticated_rpc_call", "resolve_to_did"],
    "utils.logging_config": ["configure_logging"],
    "credential_store": ["create_authenticator"],
    "local_store": ["get_connection", "ensure_schema", "upsert_contact", "append_relationship_event"],
}

# -----------------------------------------------------------------------------
# Output: Function Signatures
# -----------------------------------------------------------------------------

FUNCTION_SIGNATURES = {
    "follow": {
        "signature": "async follow(target_did: str, credential_name: str = \"default\") -> None",
        "input": {"target_did": "str", "credential_name": "str (default: 'default')"},
        "output": "None (prints result to stdout/stderr)",
    },
    "unfollow": {
        "signature": "async unfollow(target_did: str, credential_name: str = \"default\") -> None",
        "input": {"target_did": "str", "credential_name": "str (default: 'default')"},
        "output": "None (prints result to stdout/stderr)",
    },
    "get_status": {
        "signature": "async get_status(target_did: str, credential_name: str = \"default\") -> None",
        "input": {"target_did": "str", "credential_name": "str (default: 'default')"},
        "output": "None (prints result to stdout/stderr)",
    },
    "get_following": {
        "signature": "async get_following(credential_name: str = \"default\", limit: int = 50, offset: int = 0) -> None",
        "input": {"credential_name": "str", "limit": "int (default: 50)", "offset": "int (default: 0)"},
        "output": "None (prints result to stdout/stderr)",
    },
    "get_followers": {
        "signature": "async get_followers(credential_name: str = \"default\", limit: int = 50, offset: int = 0) -> None",
        "input": {"credential_name": "str", "limit": "int (default: 50)", "offset": "int (default: 0)"},
        "output": "None (prints result to stdout/stderr)",
    },
    "main": {
        "signature": "main() -> None",
        "input": "CLI arguments via argparse",
        "output": "None (delegates to async functions)",
    },
}

# -----------------------------------------------------------------------------
# Output: RPC Call Patterns (Golden Standard)
# -----------------------------------------------------------------------------

RPC_CALL_PATTERNS = {
    "follow": {
        "method": "follow",
        "params": {"target_did": "<resolved_DID>"},
        "endpoint": RPC_ENDPOINT,
    },
    "unfollow": {
        "method": "unfollow",
        "params": {"target_did": "<resolved_DID>"},
        "endpoint": RPC_ENDPOINT,
    },
    "get_status": {
        "method": "get_status",
        "params": {"target_did": "<resolved_DID>"},
        "endpoint": RPC_ENDPOINT,
    },
    "get_following": {
        "method": "get_following",
        "params": {"limit": 50, "offset": 0},
        "endpoint": RPC_ENDPOINT,
    },
    "get_followers": {
        "method": "get_followers",
        "params": {"limit": 50, "offset": 0},
        "endpoint": RPC_ENDPOINT,
    },
}

# -----------------------------------------------------------------------------
# Output: Local Store Operations (Golden Standard)
# -----------------------------------------------------------------------------

LOCAL_STORE_OPERATIONS = {
    "follow": [
        {
            "operation": "upsert_contact",
            "params": {
                "owner_did": "<user_DID>",
                "did": "<target_DID>",
                "relationship": "following",
                "followed": True,
            },
        },
        {
            "operation": "append_relationship_event",
            "params": {
                "owner_did": "<user_DID>",
                "target_did": "<target_DID>",
                "event_type": "followed",
                "status": "applied",
                "credential_name": "<credential_name>",
            },
        },
    ],
    "unfollow": [
        {
            "operation": "upsert_contact",
            "params": {
                "owner_did": "<user_DID>",
                "did": "<target_DID>",
                "relationship": "none",
                "followed": False,
            },
        },
        {
            "operation": "append_relationship_event",
            "params": {
                "owner_did": "<user_DID>",
                "target_did": "<target_DID>",
                "event_type": "unfollowed",
                "status": "applied",
                "credential_name": "<credential_name>",
            },
        },
    ],
}

# -----------------------------------------------------------------------------
# Output: Console Output Format (Golden Standard)
# -----------------------------------------------------------------------------

CONSOLE_OUTPUT_PATTERNS = {
    "follow": {
        "stderr": "Follow succeeded:",
        "stdout": "JSON formatted RPC result",
    },
    "unfollow": {
        "stderr": "Unfollow succeeded:",
        "stdout": "JSON formatted RPC result",
    },
    "get_status": {
        "stderr": "Relationship status:",
        "stdout": "JSON formatted RPC result",
    },
    "get_following": {
        "stderr": "Following list:",
        "stdout": "JSON formatted RPC result",
    },
    "get_followers": {
        "stderr": "Followers list:",
        "stdout": "JSON formatted RPC result",
    },
    "error_credential_unavailable": {
        "stdout": "Credential '<name>' unavailable; please create an identity first",
        "exit_code": 1,
    },
}


def main() -> None:
    """Print golden standard documentation."""
    print("=" * 70)
    print("DISTILL: manage_relationship.py Golden Standard I/O")
    print("=" * 70)
    print()

    print(f"Script Path: {SCRIPT_PATH}")
    print(f"RPC Endpoint: {RPC_ENDPOINT}")
    print()

    print("-" * 70)
    print("CLI INPUTS (Mutually Exclusive)")
    print("-" * 70)
    for action, info in CLI_INPUTS.items():
        print(f"\n[{action.upper()}]")
        print(f"  Argument: {info['argument']}")
        print(f"  Example:  {info['example']}")
        print(f"  Desc:     {info['description']}")
    print()

    print("-" * 70)
    print("OPTIONAL ARGUMENTS")
    print("-" * 70)
    for arg, info in OPTIONAL_ARGS.items():
        print(f"  {arg}: default={info['default']} ({info['description']})")
    print()

    print("-" * 70)
    print("MODULE DEPENDENCIES")
    print("-" * 70)
    for module, interfaces in MODULE_INPUTS.items():
        print(f"  {module}:")
        for iface in interfaces:
            print(f"    - {iface}")
    print()

    print("-" * 70)
    print("FUNCTION SIGNATURES")
    print("-" * 70)
    for func, sig_info in FUNCTION_SIGNATURES.items():
        print(f"\n{func}:")
        print(f"  Signature: {sig_info['signature']}")
        print(f"  Input:     {sig_info['input']}")
        print(f"  Output:    {sig_info['output']}")
    print()

    print("-" * 70)
    print("RPC CALL PATTERNS")
    print("-" * 70)
    print(json.dumps(RPC_CALL_PATTERNS, indent=2, ensure_ascii=False))
    print()

    print("-" * 70)
    print("LOCAL STORE OPERATIONS")
    print("-" * 70)
    print(json.dumps(LOCAL_STORE_OPERATIONS, indent=2, ensure_ascii=False))
    print()

    print("-" * 70)
    print("CONSOLE OUTPUT PATTERNS")
    print("-" * 70)
    for action, pattern in CONSOLE_OUTPUT_PATTERNS.items():
        print(f"\n[{action.upper()}]")
        for key, value in pattern.items():
            print(f"  {key}: {value}")
    print()

    print("=" * 70)
    print("DISTILL COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()
