"""蒸馏脚本：执行 test_logging_config.py 并记录黄金标准输出。"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

# 添加 scripts/ 到 sys.path 以便导入 utils.logging_config
# distill.py 位于 doc/tests/test_logging_config.py/distill.py
# 路径层级：distill.py -> test_logging_config.py/ -> tests/ -> doc/ -> project_root/
_project_root = Path(__file__).resolve().parent.parent.parent.parent
_scripts_dir = _project_root / "python" / "scripts"
sys.path.insert(0, str(_scripts_dir))

from utils.logging_config import (  # noqa: E402
    DailyRetentionFileHandler,
    cleanup_log_files,
    get_log_dir,
)


class _MutableClock:
    """用于处理器测试的简单可变时钟。"""

    def __init__(self, current: datetime) -> None:
        self.current = current

    def now(self) -> datetime:
        return self.current


def _write_log_file(log_dir: Path, day: datetime, content: str) -> Path:
    """创建具有确定性内容的托管日志文件。"""
    path = log_dir / f"awiki-agent-{day.date().isoformat()}.log"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path


def distill_get_log_dir_uses_data_dir() -> dict:
    """蒸馏：日志文件应位于 <DATA_DIR>/logs 下。"""
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        os.environ["AWIKI_DATA_DIR"] = str(tmp_path)
        
        log_dir = get_log_dir()
        
        result = {
            "test_name": "test_get_log_dir_uses_data_dir",
            "input": {"tmp_path": str(tmp_path)},
            "output": {
                "log_dir": str(log_dir),
                "expected": str(tmp_path / "logs"),
                "exists": log_dir.exists(),
            },
            "assertions": {
                "log_dir_equals_expected": log_dir == tmp_path / "logs",
                "log_dir_exists": log_dir.exists(),
            },
        }
        return result


def distill_cleanup_log_files_removes_expired_days() -> dict:
    """蒸馏：早于保留窗口的文件应被移除。"""
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        log_dir = tmp_path / "logs"
        now = datetime(2026, 3, 17, 8, 0, tzinfo=timezone.utc)

        for offset in range(17):
            day = now - timedelta(days=16 - offset)
            _write_log_file(log_dir, day, f"log-{offset}")

        deleted = cleanup_log_files(log_dir, now=now, max_retention_days=15)
        remaining = sorted(path.name for path in log_dir.glob("*.log"))

        result = {
            "test_name": "test_cleanup_log_files_removes_expired_days",
            "input": {
                "tmp_path": str(tmp_path),
                "now": now.isoformat(),
                "max_retention_days": 15,
                "files_created": 17,
            },
            "output": {
                "deleted_files": [path.name for path in deleted],
                "remaining_files": remaining,
                "deleted_count": len(deleted),
                "remaining_count": len(remaining),
            },
            "assertions": {
                "deleted_correct": [path.name for path in deleted] == [
                    "awiki-agent-2026-03-01.log",
                    "awiki-agent-2026-03-02.log",
                ],
                "first_remaining": remaining[0] == "awiki-agent-2026-03-03.log",
                "last_remaining": remaining[-1] == "awiki-agent-2026-03-17.log",
                "remaining_count_correct": len(remaining) == 15,
            },
        }
        return result


def distill_cleanup_log_files_enforces_total_size_limit() -> dict:
    """蒸馏：大小清理应首先删除最旧文件。"""
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        log_dir = tmp_path / "logs"
        now = datetime(2026, 3, 3, 8, 0, tzinfo=timezone.utc)

        _write_log_file(log_dir, datetime(2026, 3, 1, tzinfo=timezone.utc), "aaaaa")
        _write_log_file(log_dir, datetime(2026, 3, 2, tzinfo=timezone.utc), "bbbbb")
        _write_log_file(log_dir, datetime(2026, 3, 3, tzinfo=timezone.utc), "ccccc")

        deleted = cleanup_log_files(
            log_dir,
            now=now,
            max_retention_days=15,
            max_total_size_bytes=10,
        )
        remaining = sorted(path.name for path in log_dir.glob("*.log"))

        result = {
            "test_name": "test_cleanup_log_files_enforces_total_size_limit",
            "input": {
                "tmp_path": str(tmp_path),
                "now": now.isoformat(),
                "max_retention_days": 15,
                "max_total_size_bytes": 10,
                "files_created": [
                    {"name": "awiki-agent-2026-03-01.log", "size": 5},
                    {"name": "awiki-agent-2026-03-02.log", "size": 5},
                    {"name": "awiki-agent-2026-03-03.log", "size": 5},
                ],
            },
            "output": {
                "deleted_files": [path.name for path in deleted],
                "remaining_files": remaining,
            },
            "assertions": {
                "deleted_correct": [path.name for path in deleted] == ["awiki-agent-2026-03-01.log"],
                "remaining_correct": remaining == [
                    "awiki-agent-2026-03-02.log",
                    "awiki-agent-2026-03-03.log",
                ],
            },
        }
        return result


def distill_daily_retention_file_handler_writes_one_file_per_day() -> dict:
    """蒸馏：处理器应在日期变化时轮转到新文件。"""
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        log_dir = tmp_path / "logs"
        clock = _MutableClock(datetime(2026, 3, 8, 9, 0, tzinfo=timezone.utc))
        handler = DailyRetentionFileHandler(
            log_dir=log_dir,
            clock=clock.now,
            cleanup_interval_seconds=1,
        )
        handler.setFormatter(logging.Formatter("%(message)s"))

        logger = logging.Logger("test_daily_handler")
        logger.setLevel(logging.INFO)
        logger.addHandler(handler)

        try:
            logger.info("first-day")
            clock.current = datetime(2026, 3, 9, 9, 0, tzinfo=timezone.utc)
            logger.info("second-day")
        finally:
            logger.removeHandler(handler)
            handler.close()

        first_file = log_dir / "awiki-agent-2026-03-08.log"
        second_file = log_dir / "awiki-agent-2026-03-09.log"

        first_content = first_file.read_text(encoding="utf-8") if first_file.exists() else ""
        second_content = second_file.read_text(encoding="utf-8") if second_file.exists() else ""

        result = {
            "test_name": "test_daily_retention_file_handler_writes_one_file_per_day",
            "input": {
                "tmp_path": str(tmp_path),
                "first_day": "2026-03-08",
                "second_day": "2026-03-09",
            },
            "output": {
                "first_file_exists": first_file.exists(),
                "second_file_exists": second_file.exists(),
                "first_file_content": first_content.strip(),
                "second_file_content": second_content.strip(),
            },
            "assertions": {
                "first_file_exists": first_file.exists(),
                "second_file_exists": second_file.exists(),
                "first_contains_first_day": "first-day" in first_content,
                "second_contains_second_day": "second-day" in second_content,
            },
        }
        return result


def distill_configure_logging_mirrors_print_to_daily_log() -> dict:
    """蒸馏：configure_logging 应将 stdout 打印镜像到每日日志文件。"""
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        env = os.environ.copy()
        env["AWIKI_DATA_DIR"] = str(tmp_path)
        env["PYTHONPATH"] = str(_scripts_dir)

        script = """
from utils.logging_config import configure_logging
configure_logging(console_level=None, mirror_stdio=True)
print("print-to-log")
"""
        result = subprocess.run(
            [sys.executable, "-c", script],
            cwd=tmp_path,
            env=env,
            capture_output=True,
            text=True,
            check=True,
        )

        log_dir = tmp_path / "logs"
        log_files = sorted(log_dir.glob("awiki-agent-*.log"))
        log_content = log_files[0].read_text(encoding="utf-8") if log_files else ""

        distill_result = {
            "test_name": "test_configure_logging_mirrors_print_to_daily_log",
            "input": {
                "tmp_path": str(tmp_path),
                "script": script.strip(),
            },
            "output": {
                "stdout": result.stdout.strip(),
                "stderr": result.stderr.strip(),
                "log_files_count": len(log_files),
                "log_content": log_content.strip(),
            },
            "assertions": {
                "stdout_contains_print": "print-to-log" in result.stdout,
                "one_log_file_created": len(log_files) == 1,
                "log_contains_print": "print-to-log" in log_content if log_files else False,
            },
        }
        return distill_result


def main() -> None:
    """执行所有蒸馏测试并输出黄金标准结果。"""
    print("=" * 60)
    print("蒸馏脚本：test_logging_config.py")
    print("=" * 60)
    print()
    
    all_results = []
    
    tests = [
        distill_get_log_dir_uses_data_dir,
        distill_cleanup_log_files_removes_expired_days,
        distill_cleanup_log_files_enforces_total_size_limit,
        distill_daily_retention_file_handler_writes_one_file_per_day,
        distill_configure_logging_mirrors_print_to_daily_log,
    ]
    
    for test_func in tests:
        print(f"执行：{test_func.__name__}")
        result = test_func()
        all_results.append(result)
        
        # 打印摘要
        passed = all(result["assertions"].values())
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"  {status} - 断言：{len([v for v in result['assertions'].values() if v])}/{len(result['assertions'])}")
        print()
    
    # 输出完整 JSON 结果
    print("=" * 60)
    print("黄金标准输出 (JSON)")
    print("=" * 60)
    print(json.dumps(all_results, indent=2, ensure_ascii=False))
    
    # 验证所有测试通过
    all_passed = all(
        all(r["assertions"].values())
        for r in all_results
    )
    
    print()
    print("=" * 60)
    if all_passed:
        print("所有测试通过 ✓")
    else:
        print("部分测试失败 ✗")
    print("=" * 60)
    
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
