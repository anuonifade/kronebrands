"""Object storage for images uploaded from the admin.

Set MEDIA_STORAGE to "s3" (any S3-compatible bucket: AWS, R2, Spaces, MinIO) or
"cloudinary" and fill in that provider's credentials. With it unset, uploads report
themselves unavailable and the admin adds images by URL instead — which is all the
seeded catalogue needs, since those shots already live on a CDN.

Providers are imported lazily so neither SDK is required unless it is configured.
"""

import hashlib
import mimetypes
import time
import uuid
from dataclasses import dataclass

from .config import get_settings

ALLOWED_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/avif": ".avif"}


class StorageError(RuntimeError):
    """Raised when a configured provider rejects an upload."""


@dataclass
class Upload:
    url: str
    provider: str


def _key(content_type: str) -> str:
    """A fresh, unguessable path per upload, so re-uploading never overwrites."""
    ext = ALLOWED_TYPES.get(content_type) or mimetypes.guess_extension(content_type) or ".bin"
    return f"{get_settings().media_folder}/{uuid.uuid4().hex}{ext}"


class S3Storage:
    provider = "s3"

    def __init__(self, s):
        self.s = s

    def upload(self, data: bytes, filename: str, content_type: str) -> Upload:
        try:
            import boto3
        except ImportError as e:  # pragma: no cover - depends on the deployment
            raise StorageError("boto3 isn't installed. Add it to requirements.txt to upload to S3.") from e

        key = _key(content_type)
        client = boto3.client(
            "s3",
            region_name=self.s.s3_region,
            endpoint_url=self.s.s3_endpoint_url or None,
            aws_access_key_id=self.s.aws_access_key_id or None,
            aws_secret_access_key=self.s.aws_secret_access_key or None,
        )
        try:
            client.put_object(
                Bucket=self.s.s3_bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
                CacheControl="public, max-age=31536000, immutable",
            )
        except Exception as e:
            raise StorageError(f"S3 rejected the upload: {e}") from e

        if self.s.s3_public_base_url:
            return Upload(f"{self.s.s3_public_base_url.rstrip('/')}/{key}", self.provider)
        if self.s.s3_endpoint_url:
            return Upload(f"{self.s.s3_endpoint_url.rstrip('/')}/{self.s.s3_bucket}/{key}", self.provider)
        return Upload(f"https://{self.s.s3_bucket}.s3.{self.s.s3_region}.amazonaws.com/{key}", self.provider)


class CloudinaryStorage:
    provider = "cloudinary"

    def __init__(self, s):
        self.s = s

    def upload(self, data: bytes, filename: str, content_type: str) -> Upload:
        import httpx

        ts = str(int(time.time()))
        folder = self.s.media_folder
        # Cloudinary signs the alphabetically-sorted params that aren't file/api_key.
        to_sign = f"folder={folder}&timestamp={ts}{self.s.cloudinary_api_secret}"
        signature = hashlib.sha1(to_sign.encode()).hexdigest()
        try:
            r = httpx.post(
                f"https://api.cloudinary.com/v1_1/{self.s.cloudinary_cloud_name}/image/upload",
                data={"api_key": self.s.cloudinary_api_key, "timestamp": ts, "folder": folder, "signature": signature},
                files={"file": (filename, data, content_type)},
                timeout=60,
            )
            r.raise_for_status()
        except Exception as e:
            raise StorageError(f"Cloudinary rejected the upload: {e}") from e
        return Upload(r.json()["secure_url"], self.provider)


def get_storage():
    """The configured provider, or None when uploads are switched off."""
    s = get_settings()
    mode = (s.media_storage or "").strip().lower()
    if mode == "s3" and s.s3_bucket:
        return S3Storage(s)
    if mode == "cloudinary" and s.cloudinary_cloud_name and s.cloudinary_api_secret:
        return CloudinaryStorage(s)
    return None


def storage_status() -> dict:
    """What the admin UI shows above the upload box."""
    st = get_storage()
    if st:
        return {"uploads_enabled": True, "provider": st.provider, "max_bytes": get_settings().max_upload_bytes}
    configured = (get_settings().media_storage or "").strip().lower()
    reason = (
        f"MEDIA_STORAGE is set to '{configured}' but its credentials are incomplete."
        if configured
        else "No MEDIA_STORAGE configured. Set it to 's3' or 'cloudinary' to upload files."
    )
    return {"uploads_enabled": False, "provider": None, "reason": reason, "max_bytes": 0}
