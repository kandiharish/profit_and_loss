import logging

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Billing / job project. Separate from the source below on purpose: jobs
    # can be billed to one project while reading a table in another.
    bq_project: str = "nodal-plexus-492111-e9"

    # THE SOURCE, as ONE value: project.dataset.table.
    #
    # This used to be three settings (BQ_PROJECT + BQ_DATASET + BQ_GL_TABLE)
    # composed into a path, which is how a deployment ended up half-migrated:
    # the dataset was pinned in a hosting dashboard and stayed on the old
    # `warehouse_llc`, while the table name moved on to its new default. The
    # pair pointed at `warehouse_llc.Conso_GL_Dump_latest` -- a table that has
    # never existed -- and every query 404'd.
    #
    # Which table to read is a single fact, so it is a single setting. There
    # is no combination of half-updated variables that can produce a path
    # nobody intended.
    #
    # One table, fully pre-joined: every ledger column PLUS Statement,
    # Section, Ledger_ID, Ledger_Name, Sub_Ledger_Name and Elimination_Flag.
    # Conso_GL_Mapping is already folded in, so the app performs no join.
    bq_table_ref: str = "nodal-plexus-492111-e9.lyson_sons.Conso_GL_Dump_latest"

    # Superseded by bq_table_ref and NOT used to build the path. Declared only
    # so a stale value left in a deployment's environment can be detected and
    # reported, instead of being silently ignored.
    bq_dataset: str | None = None
    bq_gl_table: str | None = None

    # A query that would scan more than this FAILS instead of billing.
    bq_max_bytes_billed: int = 10_000_000_000

    frontend_origin: str = "http://localhost:3000"

    # Render / cloud deployment: paste the full service-account JSON here.
    # Leave empty when running locally with `gcloud auth application-default login`.
    google_credentials_json: str = ""

    @property
    def gl_table_ref(self) -> str:
        return self.bq_table_ref

    @property
    def dataset_ref(self) -> str:
        """`project.dataset` of the source, derived from the one setting."""
        return ".".join(self.bq_table_ref.split(".")[:2])

    @property
    def stale_settings(self) -> dict[str, str]:
        """Legacy variables still set in the environment but no longer read.

        Surfaced by /api/meta/health and logged at startup. A value that is
        set but ignored is worth saying out loud -- someone put it there
        expecting it to matter.
        """
        out: dict[str, str] = {}
        parts = self.bq_table_ref.split(".")
        dataset = parts[1] if len(parts) == 3 else ""
        table = parts[2] if len(parts) == 3 else ""
        if self.bq_dataset and self.bq_dataset != dataset:
            out["BQ_DATASET"] = self.bq_dataset
        if self.bq_gl_table and self.bq_gl_table != table:
            out["BQ_GL_TABLE"] = self.bq_gl_table
        return out

    def validate_source(self) -> None:
        """Fail fast on a malformed source, and name anything being ignored."""
        if len(self.bq_table_ref.split(".")) != 3:
            raise ValueError(
                f"BQ_TABLE_REF must be 'project.dataset.table', "
                f"got {self.bq_table_ref!r}"
            )
        for key, value in self.stale_settings.items():
            logger.warning(
                "%s=%s is set but no longer used; the source is BQ_TABLE_REF=%s. "
                "Remove %s from this environment.",
                key, value, self.bq_table_ref, key,
            )


settings = Settings()
settings.validate_source()
