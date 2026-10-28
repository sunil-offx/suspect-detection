import os
from typing import Optional
from app.providers.base import ImageProvider
from app.providers.exceptions import ProviderUnavailable, ProviderResponseError


class HuggingFaceSpaceImageProvider(ImageProvider):
    """
    Image generation provider connecting to Hugging Face Spaces via Gradio Client.
    Defaults to mrfakename/Z-Image-Turbo (https://huggingface.co/spaces/mrfakename/Z-Image-Turbo).
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "mrfakename/Z-Image-Turbo",
        height: int = 1024,
        width: int = 1024,
        num_inference_steps: int = 9,
    ):
        space_id = (model or "mrfakename/Z-Image-Turbo").strip()
        # Clean URL if full URL is passed
        if space_id.startswith("https://huggingface.co/spaces/"):
            space_id = space_id.replace("https://huggingface.co/spaces/", "").strip("/")
        elif space_id.startswith("http://huggingface.co/spaces/"):
            space_id = space_id.replace("http://huggingface.co/spaces/", "").strip("/")
        elif space_id.startswith("huggingface.co/spaces/"):
            space_id = space_id.replace("huggingface.co/spaces/", "").strip("/")

        self.space_id = space_id or "mrfakename/Z-Image-Turbo"
        self.api_key = api_key if api_key else None
        self.height = height
        self.width = width
        self.num_inference_steps = num_inference_steps
        self._client = None

    def _get_client(self):
        if self._client is None:
            try:
                from gradio_client import Client
            except ImportError:
                raise ProviderUnavailable("gradio_client library is not installed. Please install gradio-client.")

            try:
                self._client = Client(self.space_id, token=self.api_key)
            except Exception as e:
                raise ProviderUnavailable(f"Failed to connect to Hugging Face space '{self.space_id}': {str(e)}")
        return self._client

    def generate(self, prompt: str) -> bytes:
        if not prompt or not prompt.strip():
            raise ProviderResponseError("Prompt cannot be empty")

        try:
            client = self._get_client()
            # Predict using /generate_image endpoint from mrfakename/Z-Image-Turbo
            result = client.predict(
                prompt=prompt,
                height=float(self.height),
                width=float(self.width),
                num_inference_steps=float(self.num_inference_steps),
                seed=42,
                randomize_seed=True,
                api_name="/generate_image"
            )

            image_path = None
            if isinstance(result, (list, tuple)) and len(result) > 0:
                image_path = result[0]
            elif isinstance(result, str):
                image_path = result

            if not image_path or not os.path.isfile(image_path):
                raise ProviderResponseError(
                    f"No valid image returned by Hugging Face space '{self.space_id}'"
                )

            with open(image_path, "rb") as f:
                image_bytes = f.read()

            return image_bytes

        except Exception as e:
            if isinstance(e, (ProviderUnavailable, ProviderResponseError)):
                raise
            raise ProviderResponseError(f"Hugging Face space '{self.space_id}' generation failed: {str(e)}")


ZImageTurboProvider = HuggingFaceSpaceImageProvider

