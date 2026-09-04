# One step you have to run yourself

Everything is installed and tested except the part that needs your Google
account. `gcloud auth application-default login` opens a browser and waits
for you to click through consent — I cannot drive that from here.

## Open a PowerShell window and run

    gcloud auth application-default login

A browser opens. Sign in with the **same Google account** you use to view
this BigQuery project, and approve the request.

Then set the project:

    gcloud config set project nodal-plexus-492111-e9

## What this does

Writes a credential file to:

    %APPDATA%\gcloud\application_default_credentials.json

The backend reads it automatically. Nothing is stored in this repo, no keys
are involved, and the credential expires on its own.

## Permissions you need

Read-only is enough:

| Role | Scope |
|---|---|
| `roles/bigquery.jobUser` | project `nodal-plexus-492111-e9` |
| `roles/bigquery.dataViewer` | dataset `warehouse_llc` |

If you can already run queries in the BigQuery console with this account,
you almost certainly have both.

## Then tell me

I'll pick straight back up and run the full test pass against the real data:
Revenue, COGS, Operating Expenses, Other Income/Expense, Gross Profit and
Net Income, plus the property filter, date filters, comparison and
drill-down.

## Verify it worked (optional)

    gcloud auth application-default print-access-token

If that prints a long token, you are done.
