import time
import httpx
from app.providers.base import ImageProvider
from app.providers.exceptions import ProviderUnavailable, ProviderResponseError


class ReplicateFluxProvider(ImageProvider):
    def __init__(self, api_key: str, model: str = "black-forest-labs/flux-schnell"):
        if not api_key:
            raise ProviderUnavailable("Replicate API token is missing")
        self.api_key = api_key
        self.model = model
        self.base_url = "https://api.replicate.com/v1"

    def generate(self, prompt: str) -> bytes:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Prefer": "wait"
        }
        payload = {
            "input": {
                "prompt": prompt,
                "aspect_ratio": "1:1",
                "output_format": "png",
                "num_outputs": 1
            }
        }

        try:
            with httpx.Client(timeout=60.0) as client:
                res = client.post(
                    f"{self.base_url}/models/{self.model}/predictions",
                    headers=headers,
                    json=payload
                )
                if res.status_code not in (200, 201):
                    raise ProviderResponseError(f"Replicate error ({res.status_code}): {res.text}")

                prediction = res.json()
                output_url = None
                # If output returned directly with Prefer: wait
                if prediction.get("output"):
                    output_url = prediction["output"][0] if isinstance(prediction["output"], list) else prediction["output"]
                else:
                    # Poll for completion
                    poll_url = prediction["urls"]["get"]
                    for _ in range(30):
                        time.sleep(1.5)
                        poll_res = client.get(poll_url, headers={"Authorization": f"Bearer {self.api_key}"})
                        poll_data = poll_res.json()
                        status = poll_data.get("status")
                        if status == "succeeded":
                            out = poll_data.get("output")
                            output_url = out[0] if isinstance(out, list) else out
                            break
                        elif status in ("failed", "canceled"):
                            raise ProviderResponseError(f"Replicate generation {status}: {poll_data.get('error')}")

                if not output_url:
                    raise ProviderResponseError("No image URL returned from Replicate")

                # Download image bytes
                img_res = client.get(output_url)
                if img_res.status_code != 200:
                    raise ProviderResponseError(f"Failed to download generated image bytes: {img_res.status_code}")
                return img_res.content

        except Exception as e:
            if isinstance(e, (ProviderUnavailable, ProviderResponseError)):
                raise
            raise ProviderResponseError(f"Replicate generation failed: {str(e)}")
