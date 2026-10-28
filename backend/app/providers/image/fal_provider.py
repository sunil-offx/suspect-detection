import httpx
from app.providers.base import ImageProvider
from app.providers.exceptions import ProviderUnavailable, ProviderResponseError


class FalImageProvider(ImageProvider):
    def __init__(self, api_key: str, model: str = "fal-ai/flux/schnell"):
        if not api_key:
            raise ProviderUnavailable("Fal API key is missing")
        self.api_key = api_key
        self.model = model
        self.base_url = "https://fal.run"

    def generate(self, prompt: str) -> bytes:
        headers = {
            "Authorization": f"Key {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "prompt": prompt,
            "image_size": "square_hd",
            "num_images": 1,
            "output_format": "png"
        }

        try:
            with httpx.Client(timeout=60.0) as client:
                res = client.post(f"{self.base_url}/{self.model}", headers=headers, json=payload)
                if res.status_code != 200:
                    raise ProviderResponseError(f"Fal error ({res.status_code}): {res.text}")
                data = res.json()
                images = data.get("images", [])
                if not images or not images[0].get("url"):
                    raise ProviderResponseError("No image URL returned by Fal")
                url = images[0]["url"]
                img_res = client.get(url)
                return img_res.content
        except Exception as e:
            if isinstance(e, (ProviderUnavailable, ProviderResponseError)):
                raise
            raise ProviderResponseError(f"Fal request failed: {str(e)}")
