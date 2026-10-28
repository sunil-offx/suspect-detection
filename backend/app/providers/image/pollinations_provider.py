import io
import time
import logging
import urllib.parse
import urllib.request
import urllib.error
from typing import Optional
from PIL import Image

from app.providers.base import ImageProvider
from app.providers.exceptions import ProviderUnavailable, ProviderResponseError

logger = logging.getLogger("crimesketch.pollinations")


class PollinationsImageProvider(ImageProvider):
    """
    Forensic police composite sketch provider powered by Pollinations Flux.
    Generates high-resolution, photorealistic graphite/charcoal forensic sketches.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "flux",
        width: int = 1024,
        height: int = 1024,
        seed: Optional[int] = None,
    ):
        self.api_key = api_key
        self.model = model or "flux"
        self.width = width
        self.height = height
        self.seed = seed

    def generate(self, prompt: str) -> bytes:
        if not prompt or not prompt.strip():
            raise ProviderResponseError("Prompt cannot be empty")

        clean_prompt = prompt.strip()
        encoded = urllib.parse.quote(clean_prompt)
        seed_val = self.seed if self.seed is not None else (int(time.time() * 1000) % 2147483647)

        url = (
            f"https://image.pollinations.ai/prompt/{encoded}"
            f"?width={self.width}&height={self.height}"
            f"&model={self.model}&nologo=true&seed={seed_val}"
        )

        headers = {
            "User-Agent": "CrimeSketch-Forensic/1.0",
            "Accept": "image/jpeg, image/png, image/*",
        }
        if self.api_key and self.api_key.strip():
            headers["Authorization"] = f"Bearer {self.api_key.strip()}"

        max_attempts = 2
        for attempt in range(max_attempts):
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=45) as resp:
                    raw_data = resp.read()
                    if not raw_data:
                        raise ProviderResponseError("Empty image response from Pollinations")

                    # Convert to standard PNG format
                    img = Image.open(io.BytesIO(raw_data))
                    buf = io.BytesIO()
                    img.save(buf, format="PNG")
                    png_bytes = buf.getvalue()
                    logger.info(f"Pollinations generated {img.size} sketch ({len(png_bytes)} bytes)")
                    return png_bytes

            except urllib.error.HTTPError as e:
                err_body = e.read().decode("utf-8", errors="ignore")
                logger.warning(f"Pollinations HTTP {e.code} on attempt {attempt + 1}: {err_body}")

                if e.code == 402 and "FREE_LIMIT" in err_body:
                    import re
                    match = re.search(r"Retry after (\d+)s", err_body)
                    wait_sec = int(match.group(1)) if match else 20
                    if wait_sec <= 10 and attempt < max_attempts - 1:
                        logger.info(f"Rate limit cooldown: waiting {wait_sec + 1}s...")
                        time.sleep(wait_sec + 1)
                        continue
                    raise ProviderResponseError(
                        f"Image generation rate limit: please retry in {wait_sec}s."
                    )

                raise ProviderResponseError(f"Pollinations generation failed ({e.code}): {err_body}")

            except urllib.error.URLError as e:
                logger.warning(f"Pollinations connection error: {e}")
                if attempt < max_attempts - 1:
                    time.sleep(2)
                    continue
                raise ProviderUnavailable(f"Cannot reach image generation service: {e}")

            except Exception as e:
                if isinstance(e, (ProviderUnavailable, ProviderResponseError)):
                    raise
                logger.error(f"Pollinations error: {e}")
                raise ProviderResponseError(f"Sketch generation failed: {str(e)}")

        raise ProviderResponseError("Pollinations image generation exceeded retries")
