import io
from pathlib import Path
from PIL import Image
from fastapi import HTTPException, status
from app.core.config import settings

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}

ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".webm", ".ogg"}


def validate_file_size(size_bytes: int, max_mb: int = settings.MAX_UPLOAD_MB) -> None:
    max_bytes = max_mb * 1024 * 1024
    if size_bytes > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size {size_bytes / (1024 * 1024):.2f}MB exceeds maximum limit of {max_mb}MB",
        )


def validate_image(data: bytes, filename: str) -> str:
    validate_file_size(len(data))
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported image extension '{ext}'. Allowed: {list(ALLOWED_IMAGE_EXTENSIONS)}",
        )

    try:
        with Image.open(io.BytesIO(data)) as img:
            img.verify()
            detected_format = img.format
            if detected_format not in ALLOWED_IMAGE_FORMATS:
                raise HTTPException(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    detail=f"Detected image format '{detected_format}' is not permitted",
                )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="File is not a valid or readable image",
        )

    return ext


def strip_exif_and_reencode(data: bytes, ext: str) -> bytes:
    with Image.open(io.BytesIO(data)) as img:
        target_format = "JPEG" if ext.lower() in (".jpg", ".jpeg") else "PNG"
        if target_format == "JPEG" and img.mode in ("RGBA", "P"):
            clean = img.convert("RGB")
        else:
            clean = img.copy()
        out = io.BytesIO()
        clean.save(out, format=target_format)
        return out.getvalue()



def validate_audio(data: bytes, filename: str) -> str:
    validate_file_size(len(data))
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported audio extension '{ext}'. Allowed: {list(ALLOWED_AUDIO_EXTENSIONS)}",
        )

    # Magic byte sniffing for audio formats
    is_valid = False
    if len(data) >= 12:
        # MP3 ID3 header or sync frames
        if data[:3] == b"ID3" or (data[0] == 0xFF and (data[1] & 0xE0) == 0xE0):
            is_valid = True
        # RIFF WAVE
        elif data[:4] == b"RIFF" and data[8:12] == b"WAVE":
            is_valid = True
        # M4A/MP4 ftyp
        elif data[4:8] == b"ftyp":
            is_valid = True
        # WebM / Matroska
        elif data[:4] == b"\x1a\x45\xdf\xa3":
            is_valid = True
        # Ogg
        elif data[:4] == b"OggS":
            is_valid = True

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="File content does not match a supported audio format signature",
        )

    return ext
