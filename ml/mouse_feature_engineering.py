"""Feature engineering utilities for mouse-tracking attention studies.

The core output is a per-session, per-product table suitable for downstream
machine-learning models that approximate visual attention from mouse behavior.
"""

from __future__ import annotations

import argparse
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import pandas as pd


DEFAULT_MOVEMENT_EVENTS = ("mousemove", "mouseover", "mouseenter", "hover")
DEFAULT_CLICK_EVENTS = ("click", "mousedown", "mouseup")


@dataclass(frozen=True)
class FeatureEngineeringResult:
    """Structured output for attention-oriented mouse features."""

    features: pd.DataFrame
    scanpath: pd.DataFrame


def load_mouse_events(
    db_path: str | Path,
    table_name: str = "events",
    product_column: str | None = None,
) -> pd.DataFrame:
    """Load raw mouse events from SQLite.

    Expected event fields are session_id, event_type, x, y, timestamp, and a
    product identifier. The product identifier may be named product_id or
    image_id; image_id is normalized to product_id for older tracker logs.
    """

    db_path = Path(db_path)
    query = f"SELECT * FROM {table_name}"

    with sqlite3.connect(db_path) as connection:
        events = pd.read_sql_query(query, connection)

    return normalize_event_columns(events, product_column=product_column)


def normalize_event_columns(
    events: pd.DataFrame,
    product_column: str | None = None,
) -> pd.DataFrame:
    """Normalize raw event columns into the schema used by this module."""

    required_columns = {"session_id", "event_type", "x", "y", "timestamp"}
    missing = required_columns.difference(events.columns)
    if missing:
        missing_list = ", ".join(sorted(missing))
        raise ValueError(f"Missing required event columns: {missing_list}")

    normalized = events.copy()

    if product_column:
        if product_column not in normalized.columns:
            raise ValueError(f"Product column not found: {product_column}")
        normalized["product_id"] = normalized[product_column]
    elif "product_id" not in normalized.columns:
        if "image_id" in normalized.columns:
            normalized["product_id"] = normalized["image_id"]
        else:
            raise ValueError(
                "Missing product identifier column. Expected product_id "
                "or image_id, or pass product_column=..."
            )

    normalized["timestamp"] = pd.to_numeric(normalized["timestamp"], errors="coerce")
    normalized["x"] = pd.to_numeric(normalized["x"], errors="coerce")
    normalized["y"] = pd.to_numeric(normalized["y"], errors="coerce")
    normalized["event_type"] = normalized["event_type"].astype(str).str.lower()
    normalized["product_id"] = normalized["product_id"].where(
        normalized["product_id"].notna(), None
    )

    normalized = normalized.dropna(subset=["session_id", "event_type", "timestamp"])
    normalized = normalized.sort_values(["session_id", "timestamp"]).reset_index(
        drop=True
    )

    return normalized


def compute_mouse_features(
    events: pd.DataFrame,
    *,
    max_dwell_gap_seconds: float | None = 2.0,
    movement_events: Iterable[str] = DEFAULT_MOVEMENT_EVENTS,
    click_events: Iterable[str] = DEFAULT_CLICK_EVENTS,
) -> FeatureEngineeringResult:
    """Compute session-product behavioral features from normalized events.

    Dwell time is estimated by assigning the interval until the next event in
    the same session to the current product. Long gaps can be clipped to avoid
    treating inactivity or tab changes as sustained attention.
    """

    normalized = normalize_event_columns(events)
    movement_events = {event.lower() for event in movement_events}
    click_events = {event.lower() for event in click_events}

    ordered = normalized.sort_values(["session_id", "timestamp"]).copy()
    ordered["next_timestamp"] = ordered.groupby("session_id")["timestamp"].shift(-1)
    ordered["dt"] = (ordered["next_timestamp"] - ordered["timestamp"]).clip(lower=0)
    ordered["dt"] = ordered["dt"].fillna(0.0)

    if max_dwell_gap_seconds is not None:
        ordered["dt"] = ordered["dt"].clip(upper=max_dwell_gap_seconds)

    ordered["prev_x"] = ordered.groupby("session_id")["x"].shift(1)
    ordered["prev_y"] = ordered.groupby("session_id")["y"].shift(1)
    ordered["prev_timestamp"] = ordered.groupby("session_id")["timestamp"].shift(1)
    ordered["move_dt"] = ordered["timestamp"] - ordered["prev_timestamp"]
    ordered["distance"] = (
        (ordered["x"] - ordered["prev_x"]) ** 2
        + (ordered["y"] - ordered["prev_y"]) ** 2
    ) ** 0.5
    ordered["speed"] = ordered["distance"] / ordered["move_dt"]
    ordered.loc[ordered["move_dt"] <= 0, "speed"] = pd.NA

    product_events = ordered[ordered["product_id"].notna()].copy()
    if product_events.empty:
        features = _empty_features()
        scanpath = _empty_scanpath()
        return FeatureEngineeringResult(features=features, scanpath=scanpath)

    product_events["is_movement_event"] = product_events["event_type"].isin(
        movement_events
    )
    product_events["is_click_event"] = product_events["event_type"].isin(click_events)

    previous_product = ordered.groupby("session_id")["product_id"].shift(1)
    product_events["is_product_entry"] = (
        product_events["is_movement_event"]
        & product_events["product_id"].notna()
        & (product_events["product_id"] != previous_product.loc[product_events.index])
    )

    grouped = product_events.groupby(["session_id", "product_id"], sort=False)
    features = grouped.agg(
        dwell_time=("dt", "sum"),
        avg_speed=("speed", "mean"),
        hover_count=("is_product_entry", "sum"),
        click_count=("is_click_event", "sum"),
        last_timestamp=("timestamp", "max"),
    ).reset_index()

    features["dwell_time"] = features["dwell_time"].astype(float)
    features["avg_speed"] = features["avg_speed"].fillna(0.0).astype(float)
    features["hover_count"] = features["hover_count"].astype(int)
    features["click_count"] = features["click_count"].astype(int)
    features = features.sort_values(
        ["last_timestamp", "session_id", "product_id"]
    ).reset_index(drop=True)

    scanpath = build_scanpath(ordered, movement_events=movement_events)

    return FeatureEngineeringResult(
        features=features[
            [
                "session_id",
                "product_id",
                "dwell_time",
                "avg_speed",
                "hover_count",
                "click_count",
            ]
        ],
        scanpath=scanpath,
    )


def build_scanpath(
    events: pd.DataFrame,
    *,
    movement_events: Iterable[str] = DEFAULT_MOVEMENT_EVENTS,
) -> pd.DataFrame:
    """Approximate product attention order from product-entry events."""

    normalized = normalize_event_columns(events)
    movement_events = {event.lower() for event in movement_events}
    ordered = normalized.sort_values(["session_id", "timestamp"]).copy()
    ordered["previous_product_id"] = ordered.groupby("session_id")["product_id"].shift(1)

    entries = ordered[
        ordered["event_type"].isin(movement_events)
        & ordered["product_id"].notna()
        & (ordered["product_id"] != ordered["previous_product_id"])
    ].copy()

    if entries.empty:
        return _empty_scanpath()

    entries["attention_order"] = entries.groupby("session_id").cumcount() + 1
    return entries[
        ["session_id", "attention_order", "product_id", "timestamp"]
    ].reset_index(drop=True)


def build_feature_dataset(
    db_path: str | Path,
    *,
    table_name: str = "events",
    product_column: str | None = None,
    output_csv: str | Path | None = None,
    scanpath_csv: str | Path | None = None,
    max_dwell_gap_seconds: float | None = 2.0,
) -> pd.DataFrame:
    """Load SQLite events, compute features, and optionally write CSV files."""

    events = load_mouse_events(
        db_path,
        table_name=table_name,
        product_column=product_column,
    )
    result = compute_mouse_features(
        events,
        max_dwell_gap_seconds=max_dwell_gap_seconds,
    )

    if output_csv:
        result.features.to_csv(output_csv, index=False)
    if scanpath_csv:
        result.scanpath.to_csv(scanpath_csv, index=False)

    return result.features


def _empty_features() -> pd.DataFrame:
    return pd.DataFrame(
        columns=[
            "session_id",
            "product_id",
            "dwell_time",
            "avg_speed",
            "hover_count",
            "click_count",
        ]
    )


def _empty_scanpath() -> pd.DataFrame:
    return pd.DataFrame(
        columns=["session_id", "attention_order", "product_id", "timestamp"]
    )


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compute mouse-tracking behavioral features from SQLite logs."
    )
    parser.add_argument(
        "db_path",
        nargs="?",
        default=Path(__file__).resolve().parent.parent / "data" / "experiment_data.sqlite3",
        help="Path to the SQLite database. Defaults to data/experiment_data.sqlite3.",
    )
    parser.add_argument("--table", default="events", help="Event table name.")
    parser.add_argument(
        "--product-column",
        default=None,
        help="Column containing product identifiers, if not product_id or image_id.",
    )
    parser.add_argument(
        "--output-csv",
        default=Path(__file__).resolve().parent / "mouse_features.csv",
        help="CSV path for per-session, per-product features. Defaults to ml/mouse_features.csv.",
    )
    parser.add_argument(
        "--scanpath-csv",
        default=None,
        help="Optional CSV path for product attention sequence order.",
    )
    parser.add_argument(
        "--max-dwell-gap-seconds",
        type=float,
        default=2.0,
        help="Maximum interval assigned to dwell time for a single event gap.",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    features = build_feature_dataset(
        args.db_path,
        table_name=args.table,
        product_column=args.product_column,
        output_csv=args.output_csv,
        scanpath_csv=args.scanpath_csv,
        max_dwell_gap_seconds=args.max_dwell_gap_seconds,
    )
    print(features)


if __name__ == "__main__":
    main()
