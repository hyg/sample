"""Distiller script for migrate_credentials.py

Records input/output as golden standard for the credential migration CLI.
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

# Add parent directory to path for imports
script_dir = Path(__file__).resolve().parent
project_root = script_dir.parent.parent.parent  # Navigate to project root
sys.path.insert(0, str(project_root / "python" / "scripts"))

from credential_migration import migrate_legacy_credentials
from utils.logging_config import configure_logging

logger = logging.getLogger(__name__)


def distill() -> None:
    """Execute migration and record input/output as golden standard."""
    configure_logging(console_level=None, mirror_stdio=True)

    # Record input (CLI arguments simulation)
    # Default: migrate all credentials (no --credential flag)
    credential_name = None
    
    print("=" * 60)
    print("DISTILLER: migrate_credentials.py")
    print("=" * 60)
    print(f"INPUT: credential={credential_name}")
    print("-" * 60)

    # Execute migration logic
    result = migrate_legacy_credentials(credential_name)

    # Record output
    print("OUTPUT: JSON migration summary")
    print("-" * 60)
    output_json = json.dumps(result, indent=2, ensure_ascii=False)
    print(output_json)
    print("=" * 60)
    print("DISTILLER: Complete")
    print("=" * 60)


if __name__ == "__main__":
    distill()
