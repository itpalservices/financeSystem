import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = os.getenv("DATABASE_URL", "postgresql://user:password@localhost/invoicedb")
    secret_key: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    brevo_api_key: str = os.getenv("BREVO_API_KEY", "")
    object_storage_bucket: str = os.getenv("DEFAULT_OBJECT_STORAGE_BUCKET_ID", "")
    
    class Config:
        env_file = ".env"

settings = Settings()
