#!/usr/bin/env python3
"""
Capture the EXACT HTTP request and response when registering with awiki.ai.
"""

import json
import asyncio
import httpx
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
from utils.identity import create_identity
from utils.config import SDKConfig

OUTPUT_DIR = Path(__file__).parent / "tests" / "python_output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

async def capture_registration():
    print("=" * 80)
    print("Python Registration - HTTP Request/Response Capture")
    print("=" * 80)

    config = SDKConfig()
    
    # Create identity
    print("\n[1] Creating identity...")
    identity = create_identity(
        hostname="awiki.ai",
        path_prefix=["user"],
        proof_purpose="authentication",
        domain="awiki.ai",
    )
    
    print(f"DID: {identity.did}")
    
    # Build registration request
    request_payload = {
        "jsonrpc": "2.0",
        "method": "register",
        "params": {
            "did_document": identity.did_document,
            "name": "PythonCaptureTest",
            "is_agent": True
        },
        "id": 1
    }
    
    # Send HTTP request
    print("\n[2] Sending registration request to awiki.ai...")
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                f"{config.user_service_url}/user-service/did-auth/rpc",
                json=request_payload,
                headers={"Content-Type": "application/json"}
            )
            
            # Capture request and response
            capture_data = {
                "request": {
                    "url": str(response.request.url),
                    "method": response.request.method,
                    "headers": dict(response.request.headers),
                    "body": request_payload
                },
                "response": {
                    "status_code": response.status_code,
                    "headers": dict(response.headers),
                    "body": response.json()
                },
                "identity": {
                    "did": identity.did,
                    "proof": identity.did_document["proof"]
                }
            }
            
            print("\n[3] Response received:")
            print(f"Status: {response.status_code}")
            print(f"Response body: {json.dumps(response.json(), indent=2)}")
            
            # Save to file
            with open(OUTPUT_DIR / "python_http_capture.json", "w", encoding="utf-8") as f:
                json.dump(capture_data, f, indent=2, ensure_ascii=False)
            
            print(f"\n[4] Full capture saved to: {OUTPUT_DIR / 'python_http_capture.json'}")
            
        except httpx.HTTPStatusError as e:
            print(f"HTTP Error: {e}")
            print(f"Response: {e.response.text}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(capture_registration())
