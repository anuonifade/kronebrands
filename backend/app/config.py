from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongo_url: str = "mongodb://localhost:27017"
    mongo_db: str = "kronebrands"
    jwt_secret: str = "dev-secret-change-me"
    jwt_expiry_minutes: int = 60 * 12
    admin_email: str = "admin@kronebrands.com"
    admin_password: str = "change-me"
    frontend_url: str = "http://localhost:5173"
    cors_origins: str = "http://localhost:5173"
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    # Seeds the editable shipping settings the first time the app starts. After that
    # the rates live in the database and are changed from Admin → Settings.
    shipping_flat_cents: int = 2500
    free_shipping_threshold_cents: int = 50000

    # Object storage for admin image uploads. Leave media_storage empty and uploads stay
    # switched off — admins add images by URL, which is all the seeded catalogue needs.
    media_storage: str = ""  # "s3" (any S3-compatible bucket) or "cloudinary"
    s3_bucket: str = ""
    s3_region: str = "us-east-1"
    s3_endpoint_url: str = ""  # set for R2, Spaces, MinIO; leave empty for AWS
    s3_public_base_url: str = ""  # CDN in front of the bucket, if there is one
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""
    media_folder: str = "kronebrands/products"
    max_upload_bytes: int = 10 * 1024 * 1024

    @property
    def payments_mode(self) -> str:
        return "stripe" if self.stripe_secret_key else "demo"


@lru_cache
def get_settings() -> Settings:
    return Settings()
