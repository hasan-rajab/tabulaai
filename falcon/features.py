from __future__ import annotations

import math
import sqlite3
import threading
from datetime import timezone
from pathlib import Path

from falcon.schema import TransactionEvent


FEATURE_NAMES = [
    "amount",
    "amount_log",
    "velocity_5m",
    "velocity_1h",
    "amount_1h",
    "amount_zscore_24h",
    "new_device",
    "country_changed",
    "night_hour",
    "merchant_risk",
    "card_not_present",
    "device_accounts_24h",
]

MERCHANT_RISK = {
    "grocery": 0.08,
    "fuel": 0.10,
    "utilities": 0.08,
    "restaurant": 0.12,
    "travel": 0.35,
    "electronics": 0.42,
    "jewelry": 0.48,
    "gaming": 0.38,
    "crypto": 0.70,
    "money_transfer": 0.62,
    "general": 0.20,
}


class OnlineFeatureStore:
    """SQLite-backed point-in-time feature store for transaction decisions.

    Features are calculated from transactions strictly older than the current
    event, then the event is recorded after scoring. This avoids future-data
    leakage in the online path and makes replay semantics deterministic.
    """

    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._connection = sqlite3.connect(self.path, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS transactions (
              transaction_id TEXT PRIMARY KEY,
              account_id TEXT NOT NULL,
              device_id TEXT NOT NULL,
              amount REAL NOT NULL,
              country TEXT NOT NULL,
              event_ts REAL NOT NULL
            )
            """
        )
        self._connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_transactions_account_ts ON transactions(account_id, event_ts)"
        )
        self._connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_transactions_device_ts ON transactions(device_id, event_ts)"
        )
        self._connection.commit()

    def build(self, event: TransactionEvent) -> dict[str, float]:
        ts = event.timestamp.astimezone(timezone.utc).timestamp()
        five_min = ts - 300
        one_hour = ts - 3600
        one_day = ts - 86400

        account_rows = self._connection.execute(
            """
            SELECT amount, device_id, country, event_ts
            FROM transactions
            WHERE account_id=? AND event_ts < ? AND event_ts >= ?
            ORDER BY event_ts DESC
            """,
            (event.account_id, ts, one_day),
        ).fetchall()
        device_rows = self._connection.execute(
            """
            SELECT DISTINCT account_id
            FROM transactions
            WHERE device_id=? AND event_ts < ? AND event_ts >= ?
            """,
            (event.device_id, ts, one_day),
        ).fetchall()

        recent_5m = [row for row in account_rows if row["event_ts"] >= five_min]
        recent_1h = [row for row in account_rows if row["event_ts"] >= one_hour]
        amounts_24h = [float(row["amount"]) for row in account_rows]
        mean = sum(amounts_24h) / len(amounts_24h) if amounts_24h else event.amount
        if len(amounts_24h) > 1:
            variance = sum((value - mean) ** 2 for value in amounts_24h) / len(amounts_24h)
            std = math.sqrt(variance)
        else:
            std = max(1.0, event.amount * 0.25)
        zscore = (event.amount - mean) / max(std, 1.0)

        known_devices = {str(row["device_id"]) for row in account_rows}
        latest_country = str(account_rows[0]["country"]) if account_rows else event.country
        hour = event.timestamp.astimezone(timezone.utc).hour

        return {
            "amount": float(event.amount),
            "amount_log": math.log1p(float(event.amount)),
            "velocity_5m": float(len(recent_5m)),
            "velocity_1h": float(len(recent_1h)),
            "amount_1h": float(sum(float(row["amount"]) for row in recent_1h)),
            "amount_zscore_24h": float(max(-10.0, min(10.0, zscore))),
            "new_device": float(bool(account_rows) and event.device_id not in known_devices),
            "country_changed": float(bool(account_rows) and event.country != latest_country),
            "night_hour": float(hour <= 4 or hour >= 23),
            "merchant_risk": float(MERCHANT_RISK.get(event.merchant_category, MERCHANT_RISK["general"])),
            "card_not_present": float(not event.card_present),
            "device_accounts_24h": float(len(device_rows)),
        }

    def record(self, event: TransactionEvent) -> None:
        ts = event.timestamp.astimezone(timezone.utc).timestamp()
        with self._lock:
            self._connection.execute(
                """
                INSERT OR IGNORE INTO transactions
                (transaction_id, account_id, device_id, amount, country, event_ts)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    event.transaction_id,
                    event.account_id,
                    event.device_id,
                    float(event.amount),
                    event.country,
                    ts,
                ),
            )
            self._connection.commit()
