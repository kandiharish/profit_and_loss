from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    bq_project: str = "nodal-plexus-492111-e9"
    bq_dataset: str = "lyson_sons"

    # One table, fully pre-joined: every ledger column PLUS Statement,
    # Section, Ledger_ID, Ledger_Name, Sub_Ledger_Name and Elimination_Flag.
    # Conso_GL_Mapping is already folded in, so the app performs no join.
    bq_gl_table: str = "Conso_GL_Dump_latest"

    # A query that would scan more than this FAILS instead of billing.
    bq_max_bytes_billed: int = 10_000_000_000

    frontend_origin: str = "http://localhost:3000"

    # Render / cloud deployment: paste the full service-account JSON here.
    # Leave empty when running locally with `gcloud auth application-default login`.
    google_credentials_json: str = ""

    @property
    def dataset_ref(self) -> str:
        return f"{self.bq_project}.{self.bq_dataset}"

    @property
    def gl_table_ref(self) -> str:
        return f"{self.dataset_ref}.{self.bq_gl_table}"


settings = Settings()
