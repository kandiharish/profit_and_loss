from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    bq_project: str = "spherical-entry-506811-j2"
    bq_dataset: str = "qbo_api"

    # A query that would scan more than this FAILS instead of billing.
    bq_max_bytes_billed: int = 10_000_000_000

    frontend_origin: str = "http://localhost:3000"

    # Render / cloud deployment: paste the full service-account JSON here.
    # Leave empty when running locally with `gcloud auth application-default login`.
    google_credentials_json: str = ""

    @property
    def dataset_ref(self) -> str:
        return f"{self.bq_project}.{self.bq_dataset}"


settings = Settings()
