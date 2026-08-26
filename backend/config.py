from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI PDF Document Assistant (RAG)"
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 12
    COOKIE_NAME: str = "access_token"
    
    # Target RAG LLM Settings
    LLM_TEMPERATURE: float = 0.1
    FALLBACK_RESPONSE: str = "I cannot find this information in the uploaded document."

    # Supabase & NaraRouter Settings
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    NARA_ROUTER_API_KEY: str = ""
    NARA_ROUTER_BASE_URL: str = "https://router.bynara.id/v1"

    # AWS S3 Settings
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "ap-south-1"
    AWS_S3_BUCKET: str = "rag-backend-docs-prod-8h1hvq"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
