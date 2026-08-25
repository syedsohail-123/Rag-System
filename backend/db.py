from typing import Any, Optional
from config import settings

# ----------------- Supabase Client -----------------
supabase_client: Any = None

if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
    try:
        from supabase import create_client
        supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    except Exception as e:
        print(f"Supabase client initialization warning: {e}")


# ----------------- AWS S3 Client & Helpers -----------------
s3_client: Any = None

if settings.AWS_S3_BUCKET:
    try:
        import boto3
        session_kwargs = {"region_name": settings.AWS_REGION}
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            session_kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
            session_kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
        s3_client = boto3.client("s3", **session_kwargs)
    except Exception as e:
        print(f"AWS S3 client initialization warning: {e}")


def upload_file_to_s3(file_bytes: bytes, key: str, content_type: str = "application/pdf") -> bool:
    """Uploads binary file to AWS S3 bucket."""
    if not s3_client or not settings.AWS_S3_BUCKET:
        return False
    try:
        s3_client.put_object(
            Bucket=settings.AWS_S3_BUCKET,
            Key=key,
            Body=file_bytes,
            ContentType=content_type,
        )
        return True
    except Exception as e:
        print(f"Error uploading file to S3: {e}")
        return False


def get_file_from_s3(key: str) -> Optional[bytes]:
    """Retrieves binary content from AWS S3 bucket."""
    if not s3_client or not settings.AWS_S3_BUCKET:
        return None
    try:
        response = s3_client.get_object(
            Bucket=settings.AWS_S3_BUCKET,
            Key=key,
        )
        return response["Body"].read()
    except Exception as e:
        print(f"Error retrieving file from S3: {e}")
        return None


def delete_file_from_s3(key: str) -> bool:
    """Deletes object from AWS S3 bucket."""
    if not s3_client or not settings.AWS_S3_BUCKET:
        return False
    try:
        s3_client.delete_object(
            Bucket=settings.AWS_S3_BUCKET,
            Key=key,
        )
        return True
    except Exception as e:
        print(f"Error deleting file from S3: {e}")
        return False


def generate_s3_presigned_url(key: str, expiration: int = 3600) -> Optional[str]:
    """Generates a presigned URL for secure direct S3 access."""
    if not s3_client or not settings.AWS_S3_BUCKET:
        return None
    try:
        return s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.AWS_S3_BUCKET, "Key": key},
            ExpiresIn=expiration,
        )
    except Exception as e:
        print(f"Error generating presigned URL: {e}")
        return None

