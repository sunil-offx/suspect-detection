class ProviderError(Exception):
    """Base class for provider errors."""
    pass


class ProviderUnavailable(ProviderError):
    """Raised when an AI provider is missing configuration or API keys."""
    pass


class ProviderResponseError(ProviderError):
    """Raised when an external AI provider fails or returns malformed response."""
    pass
