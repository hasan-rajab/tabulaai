import pandas as pd
import numpy as np

def generate_eda(df: pd.DataFrame, meta) -> dict:
    report = {}

    for col, cmeta in meta.columns.items():
        if col not in df.columns:
            continue

        entry = {
            "dtype": cmeta.dtype,
            "missing_pct": cmeta.missing_pct,
            "n_unique": cmeta.n_unique,
        }

        if cmeta.dtype == "numeric":
            entry.update({
                "mean":   round(df[col].mean(), 4),
                "std":    round(df[col].std(), 4),
                "min":    round(df[col].min(), 4),
                "max":    round(df[col].max(), 4),
                "skew":   round(df[col].skew(), 4),
                "values": df[col].dropna().tolist()
            })

        elif cmeta.dtype == "categorical":
            top = df[col].value_counts().head(10).to_dict()
            entry["top_values"] = {str(k): int(v) for k, v in top.items()}

        report[col] = entry

    numeric_cols = [c for c, m in meta.columns.items()
                    if m.dtype == "numeric" and c in df.columns]
    if len(numeric_cols) >= 2:
        corr = df[numeric_cols].corr().round(3)
        report["_correlations"] = corr.to_dict()

    return report