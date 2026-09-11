import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.api_core import exceptions as gexc
from google.auth import exceptions as auth_exc

from .config import settings
from .routers import balance_sheet, ledger, meta, pnl

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Profit & Loss API",
    description="Read-only P&L over QuickBooks data in BigQuery.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(pnl.router)
app.include_router(balance_sheet.router)
app.include_router(ledger.router)
app.include_router(meta.router)


@app.exception_handler(auth_exc.GoogleAuthError)
async def creds_handler(_: Request, exc: auth_exc.GoogleAuthError):
    """
    Auth failures are NOT GoogleAPIError, so without this they surface as a
    bare 500 with an empty body.

    Catches the whole GoogleAuthError family, not just DefaultCredentialsError:
    user ADC tokens expire, and RefreshError ("Reauthentication is needed")
    is just as common as having no credentials at all. Both have the same fix.
    """
    kind = ("credentials_expired"
            if isinstance(exc, auth_exc.RefreshError) else "no_credentials")
    return JSONResponse(
        status_code=503,
        content={
            "error": kind,
            "detail": str(exc),
            "hint": "Run: gcloud auth application-default login",
        },
    )


@app.exception_handler(gexc.GoogleAPIError)
async def bq_error_handler(_: Request, exc: gexc.GoogleAPIError):
    msg = str(exc)
    low = msg.lower()
    if "bytes billed" in low or "maximum_bytes_billed" in low:
        hint = ("Query would scan more than the configured limit. Narrow the "
                "date range or raise BQ_MAX_BYTES_BILLED in .env.")
    elif "not found" in low:
        # Name the reference that was actually used. The generic advice sent
        # people to .env, which is not even present on a deployed host --
        # there the value comes from the dashboard, and a stale BQ_DATASET
        # combined with a newer default BQ_GL_TABLE points at a table that
        # has never existed. Printing the resolved reference makes that
        # obvious instead of a guessing game.
        hint = (f"Table not found. The app is configured to read "
                f"`{settings.gl_table_ref}`. That comes from a single setting, "
                f"BQ_TABLE_REF (the host's environment when deployed, "
                f"backend/.env locally).")
    elif "permission" in low or "denied" in low:
        hint = ("The signed-in account needs roles/bigquery.jobUser on the "
                "project and roles/bigquery.dataViewer on the dataset.")
    elif "credential" in low or "default" in low:
        hint = "Run: gcloud auth application-default login"
    else:
        hint = None
    return JSONResponse(status_code=502,
                        content={"error": "bigquery_error",
                                 "detail": msg, "hint": hint})


@app.get("/")
def root():
    return {"service": "pnl-api", "docs": "/docs",
            "start_here": "/api/meta/ledger-balance"}
