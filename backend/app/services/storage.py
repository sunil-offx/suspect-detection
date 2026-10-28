import os
import uuid
from pathlib import Path
from typing import Optional
from app.core.config import settings


class StorageService:
    def __init__(self, storage_dir: Optional[str] = None):
        self.storage_dir = Path(storage_dir or settings.STORAGE_DIR).resolve()
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_token(self, token: str) -> Path:
        # Sanitize token to avoid path traversal
        clean_name = Path(token).name
        target_path = (self.storage_dir / clean_name).resolve()
        if not str(target_path).startswith(str(self.storage_dir)):
            raise ValueError("Invalid storage token: path traversal detected")
        return target_path

    def save_file(self, content: bytes, extension: str, prefix: str = "") -> str:
        ext = extension.lstrip(".")
        token = f"{prefix}{uuid.uuid4().hex}.{ext}" if prefix else f"{uuid.uuid4().hex}.{ext}"
        target_path = self._resolve_token(token)
        with open(target_path, "wb") as f:
            f.write(content)
        return token

    def read_file(self, token: str) -> Optional[bytes]:
        try:
            target_path = self._resolve_token(token)
            if not target_path.is_file():
                return None
            with open(target_path, "rb") as f:
                return f.read()
        except Exception:
            return None

    def get_file_path(self, token: str) -> Optional[Path]:
        try:
            target_path = self._resolve_token(token)
            if target_path.is_file():
                return target_path
            return None
        except Exception:
            return None

    def delete_file(self, token: str) -> bool:
        try:
            target_path = self._resolve_token(token)
            if target_path.is_file():
                target_path.unlink()
                return True
            return False
        except Exception:
            return False


storage = StorageService()
