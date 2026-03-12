import cloudinary
import cloudinary.uploader
import os
import uuid
from dotenv import load_dotenv

load_dotenv()

CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
API_KEY = os.getenv("CLOUDINARY_API_KEY")
API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

# Configure only if credentials exist
if CLOUD_NAME and API_KEY and API_SECRET:
    cloudinary.config(
        cloud_name=CLOUD_NAME,
        api_key=API_KEY,
        api_secret=API_SECRET,
        secure=True
    )

async def upload_file(file_content, filename="file"):
    """
    Uploads a file to Cloudinary if configured, otherwise saves locally.
    """
    if CLOUD_NAME and API_KEY and API_SECRET:
        try:
            response = cloudinary.uploader.upload(file_content, folder="civil_erp_chat")
            return {
                "url": response.get("secure_url"),
                "type": response.get("resource_type")
            }
        except Exception as e:
            print(f"Cloudinary upload error, falling back to local: {e}")

    # Local storage fallback
    try:
        upload_dir = os.path.join(os.getcwd(), "static", "uploads")
        if not os.path.exists(upload_dir):
            os.makedirs(upload_dir)

        # Create unique filename
        ext = os.path.splitext(filename)[1]
        unique_name = f"{uuid.uuid4()}{ext}"
        file_path = os.path.join(upload_dir, unique_name)

        with open(file_path, "wb") as f:
            f.write(file_content)

        # Return local path (served via FastAPI static)
        # Note: In production you'd use a full static URL
        return {
            "url": f"/static/uploads/{unique_name}",
            "type": "image" if ext.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.webp'] else "file"
        }
    except Exception as e:
        print(f"Local storage error: {e}")
        return None
