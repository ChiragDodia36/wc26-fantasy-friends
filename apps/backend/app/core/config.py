from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = Field(..., alias="DATABASE_URL")
    api_football_key: str = Field(..., alias="API_FOOTBALL_KEY")
    openai_api_key: str = Field(..., alias="OPENAI_API_KEY")
    jwt_secret: str = Field(..., alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    world_cup_league_id: str = Field(..., alias="WORLD_CUP_LEAGUE_ID")
    world_cup_season: str = Field(..., alias="WORLD_CUP_SEASON")

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

