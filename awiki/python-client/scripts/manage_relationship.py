"""Follow/unfollow/view relationship status/lists.

Usage:
    # Follow
    uv run python scripts/manage_relationship.py --follow "did:wba:localhost:user:abc123"

    # Unfollow
    uv run python scripts/manage_relationship.py --unfollow "did:wba:localhost:user:abc123"

    # View relationship status with a specific DID
    uv run python scripts/manage_relationship.py --status "did:wba:localhost:user:abc123"

    # View following list
    uv run python scripts/manage_relationship.py --following

    # View followers list
    uv run python scripts/manage_relationship.py --followers

[INPUT]: SDK (RPC calls), credential_store (load identity credentials)
[OUTPUT]: Relationship operation results
[POS]: Social relationship management script

[PROTOCOL]:
1. Update this header when logic changes
2. Check the folder's CLAUDE.md after updating
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

from utils import SDKConfig, create_user_service_client, authenticated_rpc_call, resolve_to_did
from credential_store import create_authenticator


RPC_ENDPOINT = "/user-service/did/relationships/rpc"


async def follow(target_did: str, credential_name: str = "default") -> None:
    """Follow a specific DID."""
    config = SDKConfig()
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        print(f"Credential '{credential_name}' unavailable; please create an identity first")
        sys.exit(1)

    auth, _ = auth_result
    async with create_user_service_client(config) as client:
        result = await authenticated_rpc_call(
            client, RPC_ENDPOINT, "follow", {"target_did": target_did},
            auth=auth, credential_name=credential_name,
        )
        print("Follow succeeded:")
        print(json.dumps(result, indent=2, ensure_ascii=False))


async def unfollow(target_did: str, credential_name: str = "default") -> None:
    """Unfollow a specific DID."""
    config = SDKConfig()
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        print(f"Credential '{credential_name}' unavailable; please create an identity first")
        sys.exit(1)

    auth, _ = auth_result
    async with create_user_service_client(config) as client:
        result = await authenticated_rpc_call(
            client, RPC_ENDPOINT, "unfollow", {"target_did": target_did},
            auth=auth, credential_name=credential_name,
        )
        print("Unfollow succeeded:")
        print(json.dumps(result, indent=2, ensure_ascii=False))


async def get_status(target_did: str, credential_name: str = "default") -> None:
    """View relationship status with a specific DID."""
    config = SDKConfig()
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        print(f"Credential '{credential_name}' unavailable; please create an identity first")
        sys.exit(1)

    auth, _ = auth_result
    async with create_user_service_client(config) as client:
        result = await authenticated_rpc_call(
            client, RPC_ENDPOINT, "get_status", {"target_did": target_did},
            auth=auth, credential_name=credential_name,
        )
        print("Relationship status:")
        print(json.dumps(result, indent=2, ensure_ascii=False))


async def get_following(
    credential_name: str = "default",
    limit: int = 50,
    offset: int = 0,
) -> None:
    """View following list."""
    config = SDKConfig()
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        print(f"Credential '{credential_name}' unavailable; please create an identity first")
        sys.exit(1)

    auth, _ = auth_result
    async with create_user_service_client(config) as client:
        result = await authenticated_rpc_call(
            client, RPC_ENDPOINT, "get_following",
            {"limit": limit, "offset": offset},
            auth=auth, credential_name=credential_name,
        )
        print("Following list:")
        print(json.dumps(result, indent=2, ensure_ascii=False))


async def get_followers(
    credential_name: str = "default",
    limit: int = 50,
    offset: int = 0,
) -> None:
    """View followers list."""
    config = SDKConfig()
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        print(f"Credential '{credential_name}' unavailable; please create an identity first")
        sys.exit(1)

    auth, _ = auth_result
    async with create_user_service_client(config) as client:
        result = await authenticated_rpc_call(
            client, RPC_ENDPOINT, "get_followers",
            {"limit": limit, "offset": offset},
            auth=auth, credential_name=credential_name,
        )
        print("Followers list:")
        print(json.dumps(result, indent=2, ensure_ascii=False))


def main() -> None:
    parser = argparse.ArgumentParser(description="Social relationship management")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--follow", type=str, help="Follow a specific DID or handle")
    group.add_argument("--unfollow", type=str, help="Unfollow a specific DID or handle")
    group.add_argument("--status", type=str, help="View relationship status with a specific DID or handle")
    group.add_argument("--following", action="store_true", help="View following list")
    group.add_argument("--followers", action="store_true", help="View followers list")

    parser.add_argument("--credential", type=str, default="default",
                        help="Credential name (default: default)")
    parser.add_argument("--limit", type=int, default=50,
                        help="List result count (default: 50)")
    parser.add_argument("--offset", type=int, default=0,
                        help="List offset (default: 0)")

    args = parser.parse_args()

    if args.follow:
        target_did = asyncio.run(resolve_to_did(args.follow))
        asyncio.run(follow(target_did, args.credential))
    elif args.unfollow:
        target_did = asyncio.run(resolve_to_did(args.unfollow))
        asyncio.run(unfollow(target_did, args.credential))
    elif args.status:
        target_did = asyncio.run(resolve_to_did(args.status))
        asyncio.run(get_status(target_did, args.credential))
    elif args.following:
        asyncio.run(get_following(args.credential, args.limit, args.offset))
    elif args.followers:
        asyncio.run(get_followers(args.credential, args.limit, args.offset))


if __name__ == "__main__":
    main()
