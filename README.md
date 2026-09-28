# Attention & Behavior Prediction

## Overview

An experimental e-shop environment for studying user behavior through recorded browsing interactions. Users explore electronic products while the application collects mouse and task events. The e-shop is the experimental environment, rather than the final purpose of the research. The longer-term objective is Machine Learning (ML) prediction of the user's next action.

## Research Goal

Can a user's behavior and interaction history help predict their next action during product browsing? Later research may investigate whether predictions can support runtime UI adaptation and compare mouse-based behavioral signals with webcam-based tracking and university eye-tracker measurements. Prediction, adaptive interfaces, and camera/eye-tracking integration are not currently implemented.

## Current Implementation

- Python/Flask backend with Flask-CORS, SQLite storage, and HTML/CSS/JavaScript pages.
- Home catalogue, category navigation, and product details for laptops, GPUs, monitors, keyboards, and mice. Images, prices, specifications, and descriptions come from `data/products.json`. There is no cart, checkout, or payment flow.
- Browser-tab session identifiers and task progress across page navigation.
- Mouse movement, product hover, click, and scroll collection, with product/category context where available.
- Sequential T01–T06 tasks, explicit `task_start` / `task_end` events, and active-task `task_id` attribution.
- T05 laptop-detail `product_view` events and a final `task_decision` containing the selected `product_id`. Completion requires exactly two distinct viewed laptops and confirmation that the decision was stored.
- Product/session APIs, an optional debug overlay (disabled by default), and a separate pandas-based feature export utility.

## Experiment Flow

**T01 → T02 → T03 → T04 → T05 → T06**

The definitions in [experiment/tasks.md](experiment/tasks.md) are:

| Task | Intended activity |
| --- | --- |
| T01 — Initial exploration | Explore categories and products for approximately 1–2 minutes without attempting a purchase. |
| T02 — Gaming laptop | Find a laptop suitable for gaming and inspect its details. |
| T03 — GPU | Find a graphics card for a desktop upgrade and inspect its details. |
| T04 — Mouse and keyboard | Explore both categories and identify one mouse and one keyboard. |
| T05 — Compare laptops | Open and compare two different laptops, finish the task, and select the preferred laptop. |
| T06 — Free exploration | Browse freely for approximately 2–3 minutes and stop when finished. |

**Current discrepancy:** the Greek instructions in `static/js/task.js` describe an everyday-use laptop in T02 and any interesting computer-related technology product in T03, rather than the gaming laptop and GPU specified above. T01/T06 screen instructions use general durations instead of the document's precise ranges. The application does not enforce time limits. Align these instructions before participant collection; the table describes the task document, not identical on-screen wording.

## Data Collection

| Event | Recorded behavior |
| --- | --- |
| `mousemove` | Pointer movement, throttled to at most one event per 50 ms. |
| `hover` | Pointer entry into a product element; internal transitions are ignored. |
| `click` | Document clicks, with product/category context when a matching ancestor exists. |
| `scroll` | Vertical scroll offset and last known pointer coordinates; product/category are null. |
| `task_start`, `task_end` | Explicit task boundaries. |
| `product_view` | Laptop detail-page visits during T05, including back/forward-cache restores. |
| `task_decision` | Preferred laptop selected at the end of T05. |

`tracker.js` creates the session identifier in the browser, retains it through `window.name` and `sessionStorage`, and attaches it to batches sent to `POST /api/events`. The backend creates a session row on receipt if needed. `POST /api/session/start` also exists, but the normal browser flow does not call it. Browser-created sessions therefore have a database start time corresponding to first ingestion, not necessarily initial page load.

The active task supplies `task_id`; events outside an active task can have a null task ID. Task progress is stored in `sessionStorage`, not a task table. Browser ISO timestamps are converted to Unix seconds. Mouse coordinates are viewport-relative; `scroll_position` is the vertical page offset.

Batches are sent every two seconds, with an unload flush using `sendBeacon` or keepalive fetch. Failed regular sends are requeued in memory. Raw events are stored in SQLite. Derived dwell time, speed, counts, and approximate product attention order are calculated separately and **are not stored as raw tracking events**.

There is no general navigation/page-view event. Click payloads include a target description, but the backend does not persist it; page URLs are not stored either. T05 view/decision events carry product IDs but no category value; join `products` when needed.

## Database

The active database is **`data/experiment_data.sqlite3`**, configured in `app.py`. The separate root-level `experiment_data.sqlite3` in the inspected workspace has no tables and is not used by the application.

| Table | Columns and purpose |
| --- | --- |
| `products` | `id` (text primary key), `category`, `category_label`, `name`, `price`, `image_url`, `alt`, `updated_at`. Catalogue metadata upserted from JSON. Prices are text; specifications and descriptions remain in JSON. |
| `sessions` | `session_id` (text primary key), `start_time`. Links a browsing session to its events. |
| `events` | `id` (autoincrement integer primary key), `session_id`, `event_type`, `timestamp`, `x`, `y`, `task_id`, `product_id`, `mouse_x`, `mouse_y`, `category`, `scroll_position`. Raw interactions and task markers; context/coordinate fields are nullable. |

`events.session_id` declares a foreign key to `sessions`; connections do not explicitly enable SQLite foreign-key enforcement. `idx_events_session_timestamp` indexes session/time lookups. SQLite also maintains its internal `sqlite_sequence` table. There are no task, participant, prediction, or derived-feature tables.

## Project Structure

```text
.
├── app.py                         # Server, routes, schema, catalogue upserts
├── README.md
├── requirements.txt
├── .gitignore
├── data/
│   ├── products.json              # Catalogue, specs, and descriptions
│   └── experiment_data.sqlite3    # Active local database
├── experiment/
│   ├── protocol.md                # Pilot procedure and data-management plan
│   ├── tasks.md                   # Written participant tasks
│   └── participants.csv           # Local register; not connected to app
├── templates/
│   ├── index.html
│   ├── category.html
│   ├── product.html
│   └── task.html
├── static/
│   ├── css/style.css
│   ├── js/
│   │   ├── product-data.js        # Loads JSON catalogue
│   │   ├── category.js            # Category rendering
│   │   ├── product.js             # Detail rendering
│   │   ├── tracker.js             # Event collection/delivery
│   │   ├── task.js                # Task lifecycle and T05 selection
│   │   └── debug-overlay.js       # Disabled diagnostic overlay
│   └── images/                    # gpus/, keyboards/, laptops/, mice/, monitors/
├── ml/
│   ├── mouse_feature_engineering.py
│   └── mouse_features.csv         # Existing local derived output
├── logs/                          # Local Flask log files
└── experiment_data.sqlite3        # Unused root-level local database
```

Local `.git/`, `.agents/`, `.vscode/`, and Python cache directories are omitted from this application tree. SQLite files, CSV files, logs, and caches are ignored by Git and may be absent from a fresh checkout.

## Installation

Use Python 3.10 or later for the full source, including the feature utility's type annotations, and a modern browser with JavaScript enabled. The project does not pin Python or dependency versions. Dependencies are `flask`, `flask-cors`, and `pandas`; `sqlite3` is part of Python.

From the project directory, create a virtual environment and run the application. Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

On macOS/Linux, use `.venv/bin/python` in place of `.\.venv\Scripts\python.exe`.

Open **http://127.0.0.1:5000/**. Without an active task, the app redirects to `/task.html`. No separate initialization command is required: `python app.py` calls `init_db()`, creates missing tables, adds supported missing columns, and upserts catalogue rows. API handlers also call this initializer. These operations write to the active database without deleting existing event rows. The server binds to `127.0.0.1:5000` with debug mode and the reloader disabled.

## Running the Experiment

1. Start Flask and open the URL in a fresh, independently opened browser tab for each session. Avoid duplicating previous participants' tabs because task state may be inherited. There is no reset-session button.
2. Read the Greek instructions and select **Έναρξη εργασίας** (Start task). This records `task_start` and opens the catalogue.
3. Browse normally. Select **Ολοκλήρωση εργασίας** (Finish task) in the active-task panel to record `task_end` and advance to the next instruction screen.
4. During T05, open exactly two distinct laptop detail pages. Repeated visits are allowed. On finishing, choose one of the two products in the dialog; its ID is stored in `task_decision` before the task ends. Fewer than two requires more browsing; more than two blocks completion and asks for researcher intervention, without a built-in correction/reset flow.
5. Finish T06 to reach the thank-you screen. Check stored task boundaries and the T05 decision before treating the session as complete.

The other tasks rely on manual completion; their browsing objectives are not automatically verified. Tracking also runs on instruction and completion screens, so review null-task events separately.

## Inspecting Data

Use a SQLite client against `data/experiment_data.sqlite3`, preferably read-only. If the SQLite CLI is installed:

```sh
sqlite3 -readonly data/experiment_data.sqlite3
```

```sql
-- Total events
SELECT COUNT(*) AS total_events FROM events;

-- Events by task, including events outside tasks
SELECT COALESCE(task_id, '(no task)') AS task, COUNT(*) AS event_count
FROM events GROUP BY task_id ORDER BY task_id;

-- Events by type
SELECT event_type, COUNT(*) AS event_count
FROM events GROUP BY event_type ORDER BY event_count DESC;

-- T05: distinct viewed laptops and which was selected, per session
WITH viewed AS (
    SELECT DISTINCT session_id, product_id FROM events
    WHERE task_id = 'T05' AND event_type = 'product_view'
), decisions AS (
    SELECT DISTINCT session_id, product_id FROM events
    WHERE task_id = 'T05' AND event_type = 'task_decision'
)
SELECT v.session_id, v.product_id, p.name,
       CASE WHEN d.product_id IS NOT NULL THEN 1 ELSE 0 END AS selected
FROM viewed AS v
LEFT JOIN products AS p ON p.id = v.product_id
LEFT JOIN decisions AS d
    ON d.session_id = v.session_id AND d.product_id = v.product_id
ORDER BY v.session_id, v.product_id;

-- Replace the placeholder locally; do not publish session identifiers
SELECT id, task_id, event_type, timestamp, product_id,
       category, x, y, mouse_x, mouse_y, scroll_position
FROM events
WHERE session_id = '<SESSION_ID>'
ORDER BY timestamp, id;
```

A completed current T05 should have two distinct viewed laptops and one selected product. Queries report stored data without assuming every session is complete. The API also exposes `GET /api/session/<session_id>`; unlike a read-only SQLite connection, this route invokes database initialization.

## Machine Learning

There is **no trained model, training/evaluation pipeline, or next-action inference**. Initial feature engineering already exists in `ml/mouse_feature_engineering.py`:

- Aggregates by session and product, not by task.
- Estimates dwell time from the interval to the next session event, capped at two seconds by default.
- Calculates average coordinate-based speed, product-entry-based `hover_count`, and click count.
- Optionally exports an approximate product-entry sequence, called a scanpath in the utility; this is not an eye-tracking scanpath.

After collecting suitable data, run with the virtual environment's Python:

```sh
python ml/mouse_feature_engineering.py --scanpath-csv ml/scanpath.csv
```

This reads the active database and writes `ml/mouse_features.csv` and the requested scanpath CSV, replacing those output files if they exist. It does not write derived features into SQLite. Use `--output-csv` for a different feature-output path. These preliminary aggregates still need validation and further development for next-action prediction.

## Future Work

- Systematic data cleaning and exploratory data analysis.
- Extend and validate feature engineering, define next-action labels, and prepare session-separated datasets.
- Train and compare different ML models for next-action prediction.
- Investigate prediction-driven runtime UI adaptation.
- Implement webcam-based tracking and validate measurements with a university eye-tracker.
- Compare mouse, webcam, and eye-tracking signals under an appropriate study protocol.

## Experimental Considerations

[experiment/protocol.md](experiment/protocol.md) describes a planned pilot with 5–10 participants and sessions of approximately 10–15 minutes. Use pilot testing to assess task clarity, event completeness, and interruptions. Consent, recruitment, access, and retention arrangements are procedural requirements, not implemented application workflows.

Existing developer/personal test events must **not** be treated as participant study data. Record provenance and exclusions separately, preserve raw logs, and use only appropriately identified participant sessions for analysis. The database has no participant/test-data flag; the participant CSV is not automatically populated. Session IDs are pseudonymous identifiers, not proof of consent or participant provenance.

## Limitations

- Mouse movement is a behavioral signal, not direct gaze measurement. Dwell and product-entry estimates have not been validated with an eye tracker.
- Prediction, runtime adaptation, webcam tracking, and eye-tracking validation remain future work.
- Task instructions differ between documentation and UI. The protocol also mentions navigation tracking and researcher-assigned session IDs; the code has no general navigation event and normally generates IDs in the browser.
- The event buffer is in memory; delivery on navigation or connection failure is not guaranteed. There is no durable retry queue or event deduplication key.
- Page URLs and viewport dimensions are not stored. Context can be null, and the feature utility combines tasks within a session, limiting interpretation of its aggregates.
- API authentication/access control is not implemented, and CORS is enabled. The supplied local launch configuration is not a deployment setup for protecting participant data.
- The image fallback references `static/images/placeholder-product.svg`, which is absent from the inspected project.

## Status

| Stage | Current status |
| --- | --- |
| Completed | Browsing environment, SQLite event collection, browser session/task state, T01–T06 flow, T05 view/decision capture, and initial feature export. |
| In progress / next step | Preparatory stage: reconcile task/protocol wording, pilot-test the flow, verify data quality/provenance, and review initial features. A completed participant study is not established by the code. |
| Future work | Cleaned research datasets, expanded feature engineering, ML prediction/model comparisons, possible UI adaptation, and webcam/eye-tracker validation and comparison. |
