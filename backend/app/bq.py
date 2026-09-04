"""BigQuery access. Read-only, parameterised, with a hard cost ceiling."""

import json
import logging
from decimal import Decimal
from functools import lru_cache
from typing import Any

from google.auth import exceptions as auth_exc
from google.cloud import bigquery
from google.oauth2 import service_account

from .config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_client() -> bigquery.Client:
    """
    Builds a BigQuery client.

    - Local dev: uses Application Default Credentials (gcloud auth application-default login).
    - Render / cloud: reads the full service-account JSON from the
      GOOGLE_CREDENTIALS_JSON environment variable — no key file needed.
    """
    if settings.google_credentials_json:
        info = json.loads(settings.google_credentials_json)
        creds = service_account.Credentials.from_service_account_info(
            info,
            scopes=["https://www.googleapis.com/auth/bigquery.readonly"],
        )
        return bigquery.Client(project=settings.bq_project, credentials=creds)
    # Fallback: local ADC (gcloud auth application-default login)
    return bigquery.Client(project=settings.bq_project)


def param(name: str, type_: str, value: Any) -> bigquery.ScalarQueryParameter:
    return bigquery.ScalarQueryParameter(name, type_, value)


def _clean(value: Any) -> Any:
    """BigQuery NUMERIC arrives as Decimal, which json cannot serialise.
    Convert at the boundary -- arithmetic already happened in SQL, exactly."""
    if isinstance(value, Decimal):
        return float(value)
    return value


def _execute(sql: str, params: list | None) -> list[dict[str, Any]]:
    job_config = bigquery.QueryJobConfig(
        query_parameters=params or [],
        maximum_bytes_billed=settings.bq_max_bytes_billed,
        use_query_cache=True,
    )
    result = get_client().query(sql, job_config=job_config).result()
    return [{k: _clean(v) for k, v in dict(row).items()} for row in result]


def run(sql: str, params: list | None = None) -> list[dict[str, Any]]:
    """
    Execute a read-only query, recovering from stale cached credentials.

    get_client() is lru_cached, so a client built while the ADC token was
    expired keeps failing even after the user re-authenticates -- the app
    stayed broken until it was restarted, which is a confusing failure to
    hand someone. Drop the cached client and retry once; if that also
    fails the credentials are genuinely gone and the error propagates to
    the handler in main.py.
    """
    try:
        return _execute(sql, params)
    except (auth_exc.RefreshError, auth_exc.DefaultCredentialsError):
        logger.info("Auth failed; rebuilding BigQuery client and retrying once.")
        get_client.cache_clear()
        return _execute(sql, params)


def estimate_bytes(sql: str, params: list | None = None) -> int:
    """Dry run. Costs nothing."""
    job = get_client().query(
        sql,
        job_config=bigquery.QueryJobConfig(
            dry_run=True, use_query_cache=False, query_parameters=params or []
        ),
    )
    return job.total_bytes_processed
