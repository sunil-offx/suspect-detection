import re
import os
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

SENSITIVE_PATTERNS = [
    (re.compile(r'("?(?:password|token|access_token|authorization|secret|api_key)"?\s*[:=]\s*"?)([^",\s]+)("?)', re.IGNORECASE), r'\1[REDACTED]\3'),
    (re.compile(r'(Bearer\s+)[A-Za-z0-9_\-\.]+', re.IGNORECASE), r'\1[REDACTED]'),
]

ORIGINAL_TEXT_PATTERN = re.compile(r'("?original_text"?\s*[:=]\s*"?)([^"]{100,})("?)', re.IGNORECASE)


class RedactingFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        msg = super().format(record)
        # Redact credentials
        for pattern, replacement in SENSITIVE_PATTERNS:
            msg = pattern.sub(replacement, msg)
        # Truncate long original_text
        msg = ORIGINAL_TEXT_PATTERN.sub(lambda m: f"{m.group(1)}{m.group(2)[:60]}...[TRUNCATED]{m.group(3)}", msg)
        return msg


def setup_logging():
    log_dir = Path("logs")
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "crimesketch.log"

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    formatter = RedactingFormatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    )

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.INFO)

    # File handler
    file_handler = RotatingFileHandler(
        str(log_file),
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.INFO)

    # Replace existing handlers
    root_logger.handlers = [console_handler, file_handler]
