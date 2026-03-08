"""Create group/invite/join/view members.

Usage:
    # Create a group
    uv run python scripts/manage_group.py --create --group-name "Tech Discussion" --description "Discuss tech topics"

    # Invite a user to join a group
    uv run python scripts/manage_group.py --invite --group-id GROUP_ID --target-did "did:wba:..."

    # Join a group (via invite ID)
    uv run python scripts/manage_group.py --join --group-id GROUP_ID --invite-id INVITE_ID

    # View group members
    uv run python scripts/manage_group.py --members --group-id GROUP_ID

[INPUT]: SDK (RPC calls), credential_store (load identity credentials)
[OUTPUT]: Group operation results
[POS]: Group management script

[PROTOCOL]:
1. Update this header when logic changes
2. Check the folder's CLAUDE.md after updating
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

from utils import SDKConfig, create_user_service_client, authenticated_rpc_call
from credential_store import create_authenticator


RPC_ENDPOINT = "/user-service/did/relationships/rpc"


async def create_group(
    group_name: str,
    description: str | None = None,
    max_members: int = 100,
    is_public: bool = True,
    credential_name: str = "default",
) -> None:
    """Create a group."""
    params: dict = {
        "name": group_name,
        "max_members": max_members,
        "is_public": is_public,
    }
    if description:
        params["description"] = description

    config = SDKConfig()
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        print(f"Credential '{credential_name}' unavailable; please create an identity first")
        sys.exit(1)

    auth, _ = auth_result
    async with create_user_service_client(config) as client:
        result = await authenticated_rpc_call(
            client, RPC_ENDPOINT, "create_group", params,
            auth=auth, credential_name=credential_name,
        )
        print("Group created successfully:")
        print(json.dumps(result, indent=2, ensure_ascii=False))


async def invite_to_group(
    group_id: str,
    target_did: str,
    credential_name: str = "default",
) -> None:
    """Invite a user to join a group."""
    config = SDKConfig()
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        print(f"Credential '{credential_name}' unavailable; please create an identity first")
        sys.exit(1)

    auth, _ = auth_result
    async with create_user_service_client(config) as client:
        result = await authenticated_rpc_call(
            client, RPC_ENDPOINT, "invite",
            {"group_id": group_id, "target_did": target_did},
            auth=auth, credential_name=credential_name,
        )
        print("Invitation sent successfully:")
        print(json.dumps(result, indent=2, ensure_ascii=False))


async def join_group(
    group_id: str,
    invite_id: str,
    credential_name: str = "default",
) -> None:
    """Join a group via invitation."""
    config = SDKConfig()
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        print(f"Credential '{credential_name}' unavailable; please create an identity first")
        sys.exit(1)

    auth, _ = auth_result
    async with create_user_service_client(config) as client:
        result = await authenticated_rpc_call(
            client, RPC_ENDPOINT, "join",
            {"group_id": group_id, "invite_id": invite_id},
            auth=auth, credential_name=credential_name,
        )
        print("Joined group successfully:")
        print(json.dumps(result, indent=2, ensure_ascii=False))


async def get_group_members(
    group_id: str,
    credential_name: str = "default",
) -> None:
    """View group members."""
    config = SDKConfig()
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        print(f"Credential '{credential_name}' unavailable; please create an identity first")
        sys.exit(1)

    auth, _ = auth_result
    async with create_user_service_client(config) as client:
        result = await authenticated_rpc_call(
            client, RPC_ENDPOINT, "get_group_members",
            {"group_id": group_id},
            auth=auth, credential_name=credential_name,
        )
        print("Group members:")
        print(json.dumps(result, indent=2, ensure_ascii=False))


def main() -> None:
    parser = argparse.ArgumentParser(description="Group management")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--create", action="store_true", help="Create a group")
    group.add_argument("--invite", action="store_true", help="Invite a user to a group")
    group.add_argument("--join", action="store_true", help="Join a group")
    group.add_argument("--members", action="store_true", help="View group members")

    parser.add_argument("--group-name", type=str, help="Group name (required for creation)")
    parser.add_argument("--description", type=str, help="Group description")
    parser.add_argument("--group-id", type=str, help="Group ID")
    parser.add_argument("--target-did", type=str, help="Target DID (required for invitation)")
    parser.add_argument("--invite-id", type=str, help="Invite ID (required for joining)")
    parser.add_argument("--max-members", type=int, default=100,
                        help="Maximum members (default: 100)")
    parser.add_argument("--public", action="store_true", default=True,
                        help="Whether the group is public")
    parser.add_argument("--credential", type=str, default="default",
                        help="Credential name (default: default)")

    args = parser.parse_args()

    if args.create:
        if not args.group_name:
            parser.error("Creating a group requires --group-name")
        asyncio.run(create_group(
            args.group_name, args.description, args.max_members,
            args.public, args.credential,
        ))
    elif args.invite:
        if not args.group_id or not args.target_did:
            parser.error("Invitation requires --group-id and --target-did")
        asyncio.run(invite_to_group(args.group_id, args.target_did, args.credential))
    elif args.join:
        if not args.group_id or not args.invite_id:
            parser.error("Joining a group requires --group-id and --invite-id")
        asyncio.run(join_group(args.group_id, args.invite_id, args.credential))
    elif args.members:
        if not args.group_id:
            parser.error("Viewing members requires --group-id")
        asyncio.run(get_group_members(args.group_id, args.credential))


if __name__ == "__main__":
    main()
