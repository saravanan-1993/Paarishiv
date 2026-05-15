import cloudinary
import cloudinary.uploader
import os
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()

CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
API_KEY = os.getenv("CLOUDINARY_API_KEY")
API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv',
    '.txt', '.zip', '.rar',
}


def validate_upload(file_content: bytes, filename: str):
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024 * 1024)}MB."
        )
    ext = os.path.splitext(filename)[1].lower()
    if ext and ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed. Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )


if CLOUD_NAME and API_KEY and API_SECRET:
    cloudinary.config(
        cloud_name=CLOUD_NAME,
        api_key=API_KEY,
        api_secret=API_SECRET,
        secure=True
    )


async def _get_credentials():
    """Returns (cloud_name, api_key, api_secret). ENV first, DB fallback. Raises if missing."""
    c_name, c_key, c_secret = CLOUD_NAME, API_KEY, API_SECRET

    if not (c_name and c_key and c_secret):
        try:
            from database import db
            settings = await db.settings.find_one({"type": "cloudinary_config"})
            if settings:
                c_name = c_name or settings.get("cloudName")
                c_key = c_key or settings.get("apiKey")
                c_secret = c_secret or settings.get("apiSecret")
        except Exception as e:
            print(f"[Cloudinary] DB settings lookup failed: {e}")

    if not (c_name and c_key and c_secret):
        raise HTTPException(
            status_code=500,
            detail="Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in environment or settings."
        )

    return c_name, c_key, c_secret


async def upload_file(file_content, filename="file", folder="civil_erp_chat"):
    """
    Uploads to Cloudinary. No local fallback - fails loudly if Cloudinary unreachable.
    """
    validate_upload(file_content, filename)
    c_name, c_key, c_secret = await _get_credentials()

    if not (CLOUD_NAME and API_KEY and API_SECRET):
        cloudinary.config(
            cloud_name=c_name,
            api_key=c_key,
            api_secret=c_secret,
            secure=True
        )

    try:
        response = cloudinary.uploader.upload(file_content, folder=folder)
    except Exception as e:
        print(f"[Cloudinary] Upload failed for {filename}: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"File upload to Cloudinary failed: {str(e)}"
        )

    secure_url = response.get("secure_url")
    if not secure_url:
        raise HTTPException(
            status_code=502,
            detail="Cloudinary returned no URL. Upload may have failed."
        )

    return {
        "url": secure_url,
        "type": response.get("resource_type", "file"),
        "public_id": response.get("public_id"),
    }
