"""SoundCloud API helpers (see https://developers.soundcloud.com/docs/api/guide)."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

import httpx

API_BASE = "https://api.soundcloud.com"


class SoundCloudAPIError(Exception):
    """Raised when the SoundCloud API returns a non-success HTTP status."""

    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        super().__init__(f"SoundCloud API error ({status_code}): {message}")


class SoundCloudUnauthorizedError(SoundCloudAPIError):
    """Raised on HTTP 401 — missing or invalid access token."""


class SoundCloudRateLimitError(SoundCloudAPIError):
    """Raised on HTTP 429 — rate limit exceeded; back off before retrying."""


def _parse_error_message(response: httpx.Response) -> str:
    try:
        data = response.json()
    except ValueError:
        return response.reason_phrase or f"HTTP {response.status_code}"

    parts: list[str] = []
    if data.get("message"):
        parts.append(str(data["message"]))
    for err in data.get("errors") or []:
        if err.get("error_message"):
            parts.append(str(err["error_message"]))
    if data.get("error"):
        parts.append(str(data["error"]))
    return "; ".join(parts) or response.reason_phrase or f"HTTP {response.status_code}"


def _raise_for_status(response: httpx.Response) -> None:
    if response.is_success:
        return

    message = _parse_error_message(response)
    status = response.status_code

    if status == 401:
        raise SoundCloudUnauthorizedError(
            status,
            "Authentication failed. Verify the Authorization header contains a valid OAuth access token.",
        )
    if status == 429:
        raise SoundCloudRateLimitError(
            status,
            "Rate limit exceeded. Back off exponentially before retrying.",
        )
    raise SoundCloudAPIError(status, message)


def search_tracks(
    query: str,
    access_token: str,
    limit: int = 20,
) -> tuple[list[dict[str, Any]], str | None]:
    """
    Search SoundCloud tracks.

    Calls GET /tracks with linked_partitioning=true. Returns the track objects
    from the first page and next_href when additional pages are available.

    Args:
        query: Search string (maps to the ``q`` query parameter).
        access_token: OAuth access token (client credentials or authorization code).
        limit: Number of results per page (1–200; API default is 50).

    Returns:
        A tuple of (tracks, next_href). next_href is None when there are no more pages.

    Raises:
        SoundCloudUnauthorizedError: On HTTP 401.
        SoundCloudRateLimitError: On HTTP 429.
        SoundCloudAPIError: On other non-success HTTP status codes.
    """
    if not access_token:
        raise SoundCloudUnauthorizedError(
            401,
            "Authentication failed. An access token is required.",
        )

    if not 1 <= limit <= 200:
        raise ValueError("limit must be between 1 and 200")

    with httpx.Client(timeout=30.0) as client:
        response = client.get(
            f"{API_BASE}/tracks",
            params={
                "q": query,
                "limit": limit,
                "linked_partitioning": "true",
            },
            headers={
                "accept": "application/json; charset=utf-8",
                "Authorization": f"OAuth {access_token}",
            },
        )

    _raise_for_status(response)
    data = response.json()

    if isinstance(data, list):
        # Deprecated non-paginated array response
        return data, None

    tracks = data.get("collection") or []
    next_href = data.get("next_href") or None
    return tracks, next_href


def get_related_artists(
    user_urn: str,
    access_token: str,
    limit: int = 10,
) -> tuple[list[dict[str, Any]], str | None]:
    """
    Fetch related artist recommendations for a SoundCloud user.

    Calls GET /users/{user_urn}/related with linked_partitioning=true.
    Returns user objects from the first page and next_href when more pages exist.

    Args:
        user_urn: SoundCloud user URN (e.g. ``soundcloud:users:948745750``).
        access_token: OAuth access token (client credentials or authorization code).
        limit: Number of results per page (1–200; API default is 50).

    Returns:
        A tuple of (users, next_href). next_href is None when there are no more pages.

    Raises:
        SoundCloudUnauthorizedError: On HTTP 401.
        SoundCloudRateLimitError: On HTTP 429.
        SoundCloudAPIError: On other non-success HTTP status codes.
    """
    if not access_token:
        raise SoundCloudUnauthorizedError(
            401,
            "Authentication failed. An access token is required.",
        )

    if not user_urn:
        raise ValueError("user_urn is required")

    if not 1 <= limit <= 200:
        raise ValueError("limit must be between 1 and 200")

    encoded_urn = quote(user_urn, safe="")

    with httpx.Client(timeout=30.0) as client:
        response = client.get(
            f"{API_BASE}/users/{encoded_urn}/related",
            params={
                "limit": limit,
                "linked_partitioning": "true",
            },
            headers={
                "accept": "application/json; charset=utf-8",
                "Authorization": f"OAuth {access_token}",
            },
        )

    _raise_for_status(response)
    data = response.json()

    if isinstance(data, list):
        return data, None

    users = data.get("collection") or []
    next_href = data.get("next_href") or None
    return users, next_href
