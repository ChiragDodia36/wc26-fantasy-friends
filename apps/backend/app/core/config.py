from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = Field(..., alias="DATABASE_URL")

    # Auth
    jwt_secret: str = Field(..., alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")

    # API-Football (free, 100 req/day — seeding + post-match stats only)
    api_football_key: str = Field(..., alias="API_FOOTBALL_KEY")
    world_cup_league_id: str = Field(default="1", alias="WORLD_CUP_LEAGUE_ID")
    world_cup_season: str = Field(default="2022", alias="WORLD_CUP_SEASON")

    # football-data.org (free, unlimited — live score polling)
    football_data_token: Optional[str] = Field(default=None, alias="FOOTBALL_DATA_TOKEN")

    # Firebase admin (optional until Step 5)
    firebase_service_account_json: Optional[str] = Field(
        default=None, alias="FIREBASE_SERVICE_ACCOUNT_JSON"
    )

    # Ollama (local LLM inference — no API key needed)
    ollama_base_url: str = Field(
        default="http://localhost:11434/v1", alias="OLLAMA_BASE_URL"
    )
    ollama_model: str = Field(default="qwen3:4b", alias="OLLAMA_MODEL")

    # OpenAI-compatible key (set to "ollama" when using Ollama, unused otherwise)
    openai_api_key: Optional[str] = Field(default=None, alias="OPENAI_API_KEY")

    # RL executor
    rl_model_path: str = Field(
        default="./models/rl_executor.pth", alias="RL_MODEL_PATH"
    )

    # ChromaDB episodic memory
    chromadb_path: str = Field(default="./data/chromadb", alias="CHROMADB_PATH")


settings = Settings()
