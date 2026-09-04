import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
TEMPLATES_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"
SCRIPTS_DIR = STATIC_DIR / "js"

DB_PATH = DATA_DIR / "experiment_data.sqlite3"
PRODUCTS_PATH = DATA_DIR / "products.json"

app = Flask(__name__)
CORS(app)


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def load_products():
    with PRODUCTS_PATH.open(encoding="utf-8") as products_file:
        return json.load(products_file)


def init_db():
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                category_label TEXT NOT NULL,
                name TEXT NOT NULL,
                price TEXT NOT NULL,
                image_url TEXT NOT NULL,
                alt TEXT NOT NULL,
                updated_at TIMESTAMP NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                start_time TIMESTAMP NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                x REAL,
                y REAL,
                timestamp REAL NOT NULL,
                product_id TEXT,
                mouse_x REAL,
                mouse_y REAL,
                category TEXT,
                scroll_position REAL,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            )
            """
        )
        columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(events)").fetchall()
        }
        # These migrations are additive: existing event rows are preserved and
        # remain readable through the legacy x/y columns.
        event_column_definitions = {
            "product_id": "TEXT",
            "mouse_x": "REAL",
            "mouse_y": "REAL",
            "category": "TEXT",
            "scroll_position": "REAL",
        }
        for column_name, column_type in event_column_definitions.items():
            if column_name not in columns:
                conn.execute(
                    f"ALTER TABLE events ADD COLUMN {column_name} {column_type}"
                )
        product_columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(products)").fetchall()
        }
        if "image_url" not in product_columns:
            conn.execute("ALTER TABLE products ADD COLUMN image_url TEXT NOT NULL DEFAULT ''")
        if "alt" not in product_columns:
            conn.execute("ALTER TABLE products ADD COLUMN alt TEXT NOT NULL DEFAULT ''")
        if "updated_at" not in product_columns:
            conn.execute("ALTER TABLE products ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT 0")
        now = utc_timestamp()
        product_rows = [
            (
                product["id"],
                product["category"],
                product["categoryLabel"],
                product["name"],
                product["price"],
                product["image_url"],
                product["alt"],
                now,
            )
            for product in load_products()
        ]
        conn.executemany(
            """
            INSERT INTO products (id, category, category_label, name, price, image_url, alt, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                category = excluded.category,
                category_label = excluded.category_label,
                name = excluded.name,
                price = excluded.price,
                image_url = excluded.image_url,
                alt = excluded.alt,
                updated_at = excluded.updated_at
            """,
            product_rows,
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_events_session_timestamp
            ON events (session_id, timestamp)
            """
        )


def utc_timestamp():
    return datetime.now(timezone.utc).timestamp()


def normalize_timestamp(value):
    if isinstance(value, (int, float)):
        return float(value)

    if isinstance(value, str):
        try:
            normalized = value.replace("Z", "+00:00")
            return datetime.fromisoformat(normalized).timestamp()
        except ValueError:
            return None

    return None


@app.get("/")
def index():
    return send_from_directory(TEMPLATES_DIR, "index.html")


@app.get("/style.css")
def stylesheet():
    return send_from_directory(STATIC_DIR / "css", "style.css")


@app.get("/category.html")
def category_page():
    return send_from_directory(TEMPLATES_DIR, "category.html")


@app.get("/product.html")
def product_page():
    return send_from_directory(TEMPLATES_DIR, "product.html")


@app.get("/product-data.js")
def product_data_script():
    return send_from_directory(SCRIPTS_DIR, "product-data.js")


@app.get("/data/products.json")
def products_data():
    return send_from_directory(DATA_DIR, "products.json")


@app.get("/category.js")
def category_script():
    return send_from_directory(SCRIPTS_DIR, "category.js")


@app.get("/product.js")
def product_script():
    return send_from_directory(SCRIPTS_DIR, "product.js")


@app.get("/tracker.js")
def tracker_script():
    return send_from_directory(SCRIPTS_DIR, "tracker.js")


@app.get("/images/<path:filename>")
def images(filename):
    return send_from_directory(STATIC_DIR / "images", filename)


@app.get("/api/products")
def get_products():
    init_db()
    with get_db_connection() as conn:
        products = conn.execute(
            """
            SELECT id, category, category_label, name, price, image_url, alt
            FROM products
            ORDER BY category, id
            """
        ).fetchall()

    return jsonify([dict(product) for product in products])


@app.post("/api/session/start")
def start_session():
    init_db()
    session_id = str(uuid.uuid4())
    start_time = utc_timestamp()

    with get_db_connection() as conn:
        conn.execute(
            "INSERT INTO sessions (session_id, start_time) VALUES (?, ?)",
            (session_id, start_time),
        )

    return jsonify({"session_id": session_id, "start_time": start_time}), 201


@app.post("/api/events")
def receive_events():
    init_db()
    payload = request.get_json(silent=True) or {}
    session_id = payload.get("session_id")
    raw_events = payload.get("events")

    if not session_id:
        return jsonify({"error": "session_id is required"}), 400

    if not isinstance(raw_events, list):
        return jsonify({"error": "events must be a list"}), 400

    rows = []
    for event in raw_events:
        if not isinstance(event, dict):
            continue

        event_type = event.get("event_type")
        timestamp = normalize_timestamp(event.get("timestamp"))

        if not event_type or timestamp is None:
            continue

        # Bind each incoming field to its matching column.  Keeping x/y
        # separate from mouse_x/mouse_y preserves the existing event format
        # while also recording the new explicit mouse-coordinate fields.
        rows.append(
            (
                session_id,
                event_type,
                event.get("x"),
                event.get("y"),
                timestamp,
                event.get("product_id") or event.get("image_id"),
                event.get("mouse_x"),
                event.get("mouse_y"),
                event.get("category"),
                event.get("scroll_position"),
            )
        )

    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT OR IGNORE INTO sessions (session_id, start_time)
            VALUES (?, ?)
            """,
            (session_id, utc_timestamp()),
        )

        if rows:
            conn.executemany(
                """
                INSERT INTO events (
                    session_id, event_type, x, y, timestamp, product_id,
                    mouse_x, mouse_y, category, scroll_position
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                rows,
            )

    return jsonify({"session_id": session_id, "received": len(raw_events), "stored": len(rows)})


@app.get("/api/session/<session_id>")
def get_session_events(session_id):
    init_db()
    with get_db_connection() as conn:
        session = conn.execute(
            "SELECT session_id, start_time FROM sessions WHERE session_id = ?",
            (session_id,),
        ).fetchone()

        if session is None:
            return jsonify({"error": "session not found"}), 404

        events = conn.execute(
            """
            SELECT
                id, session_id, event_type, x, y, timestamp, product_id,
                mouse_x, mouse_y, category, scroll_position
            FROM events
            WHERE session_id = ?
            ORDER BY timestamp ASC, id ASC
            """,
            (session_id,),
        ).fetchall()

    return jsonify(
        {
            "session": dict(session),
            "event_count": len(events),
            "events": [dict(event) for event in events],
        }
    )


if __name__ == "__main__":
    init_db()
    app.run(host="127.0.0.1", port=5000, debug=False, use_reloader=False)
