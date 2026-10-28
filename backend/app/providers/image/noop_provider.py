from app.providers.base import ImageProvider
from app.providers.exceptions import ProviderUnavailable


class NoOpImageProvider(ImageProvider):
    def __init__(self, message: str = "IMAGE_PROVIDER not configured or IMAGE_API_KEY not set"):
        self.message = message

    def generate(self, prompt: str) -> bytes:
        raise ProviderUnavailable(self.message)
