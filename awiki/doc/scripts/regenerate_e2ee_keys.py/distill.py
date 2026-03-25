"""Distill script for regenerate_e2ee_keys.py.

Records inputs and outputs as golden standard for the E2EE key regeneration script.
"""

import argparse
import asyncio
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
script_dir = Path(__file__).parent.resolve()
project_root = script_dir.parent.parent.parent
python_scripts = project_root / "python" / "scripts"
sys.path.insert(0, str(python_scripts))

from utils.logging_config import configure_logging

logger = logging.getLogger(__name__)


def record_input(args: argparse.Namespace, output_file: Path) -> None:
    """Record input parameters."""
    input_data = {
        "timestamp": datetime.now().isoformat(),
        "script": "python/scripts/regenerate_e2ee_keys.py",
        "parameters": {
            "credential": args.credential,
            "force": args.force,
        },
    }
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(input_data, f, indent=2, ensure_ascii=False)
    print(f"Input recorded to: {output_file}")


def record_output(result: dict, output_file: Path) -> None:
    """Record output results."""
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"Output recorded to: {output_file}")


async def run_and_distill(
    credential: str,
    force: bool,
    output_dir: Path,
) -> dict:
    """Run the regenerate_e2ee_keys function and record results."""
    from regenerate_e2ee_keys import regenerate_e2ee_keys

    result = {
        "timestamp": datetime.now().isoformat(),
        "script": "python/scripts/regenerate_e2ee_keys.py",
        "input": {
            "credential": credential,
            "force": force,
        },
        "output": {},
        "status": "pending",
    }

    try:
        # Capture stdout
        import io
        from contextlib import redirect_stdout

        output_buffer = io.StringIO()

        with redirect_stdout(output_buffer):
            await regenerate_e2ee_keys(
                credential_name=credential,
                force=force,
            )

        captured_output = output_buffer.getvalue()

        result["output"]["stdout"] = captured_output
        result["status"] = "success"

    except SystemExit as e:
        result["status"] = "exit"
        result["output"]["exit_code"] = e.code if e.code is not None else 0
        result["output"]["note"] = "Script exited normally (e.g., credential not found or already has keys)"

    except Exception as e:
        result["status"] = "error"
        result["output"]["error"] = str(e)
        result["output"]["error_type"] = type(e).__name__

    return result


def main() -> None:
    configure_logging(console_level=None, mirror_stdio=True)

    parser = argparse.ArgumentParser(
        description="Distill script for regenerate_e2ee_keys.py - records inputs/outputs as golden standard"
    )
    parser.add_argument(
        "--credential",
        type=str,
        default="default",
        help="Credential name (default: default)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force regeneration even if E2EE keys already exist",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Output directory for recorded data (default: same as script)",
    )
    args = parser.parse_args()

    output_dir = Path(args.output_dir) if args.output_dir else Path(__file__).parent.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    # Record input
    input_file = output_dir / "distill_input.json"
    record_input(args, input_file)

    # Run and record output
    print(f"\nRunning regenerate_e2ee_keys with credential={args.credential}, force={args.force}")
    result = asyncio.run(run_and_distill(args.credential, args.force, output_dir))

    # Record output
    output_file = output_dir / "distill_output.json"
    record_output(result, output_file)

    print(f"\nDistillation complete!")
    print(f"  Status: {result['status']}")
    if result["status"] == "success":
        print(f"  Output captured: {len(result['output'].get('stdout', ''))} bytes")
    elif result["status"] == "exit":
        print(f"  Exit code: {result['output'].get('exit_code', 'N/A')}")
    elif result["status"] == "error":
        print(f"  Error: {result['output'].get('error', 'Unknown')}")


if __name__ == "__main__":
    main()
