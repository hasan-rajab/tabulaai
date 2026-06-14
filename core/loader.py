import pandas as pd
import numpy as np
from dataclasses import dataclass

@dataclass
class ColumnMeta:
    name: str
    dtype: str
    missing_pct: float
    n_unique: int
    sample_values: list

@dataclass
class DatasetMeta:
    n_rows: int
    n_cols: int
    columns: dict
    suggested_tasks: list
    potential_targets: list

def detect_dtype(col: pd.Series) -> str:
    if pd.api.types.is_numeric_dtype(col):
        return "numeric"
    try:
        pd.to_datetime(col, infer_datetime_format=True)
        return "datetime"
    except:
        pass
    ratio = col.nunique() / max(len(col), 1)
    if ratio > 0.5 and col.dtype == object:
        return "text"
    return "categorical"

def suggest_tasks(meta_cols: dict):
    tasks = ["anomaly_detection", "clustering"]
    clf_targets = []
    reg_targets = []

    for k, v in meta_cols.items():
        if "id" in k.lower() or k.lower() == "index":
            continue

        if v.dtype == "categorical" and 2 <= v.n_unique <= 20:
            clf_targets.append(k)

        if v.dtype == "numeric":
            if v.n_unique <= 2:
                clf_targets.append(k)
            elif v.n_unique <= 20:
                clf_targets.append(k)
                reg_targets.append(k)
            else:
                reg_targets.append(k)

    if clf_targets:
        tasks.append("classification")
    if reg_targets:
        tasks.append("regression")

    all_targets = list(dict.fromkeys(clf_targets + reg_targets))
    return tasks, all_targets


def get_targets_for_task(meta_cols: dict, task: str) -> list:
    targets = []
    for k, v in meta_cols.items():
        if "id" in k.lower() or k.lower() == "index":
            continue
        if task == "classification":
            if v.dtype == "categorical" and 2 <= v.n_unique <= 20:
                targets.append(k)
            elif v.dtype == "numeric" and v.n_unique <= 20:
                targets.append(k)
        elif task == "regression":
            if v.dtype == "numeric" and v.n_unique > 10:
                targets.append(k)
    return targets

def load_csv(filepath) -> tuple:
    df = pd.read_csv(filepath)
    df.columns = df.columns.str.strip()

    col_meta = {}
    for col in df.columns:
        dtype = detect_dtype(df[col])
        col_meta[col] = ColumnMeta(
            name=col,
            dtype=dtype,
            missing_pct=round(df[col].isna().mean() * 100, 2),
            n_unique=df[col].nunique(),
            sample_values=df[col].dropna().unique()[:5].tolist()
        )

    tasks, targets = suggest_tasks(col_meta)

    meta = DatasetMeta(
        n_rows=df.shape[0],
        n_cols=df.shape[1],
        columns=col_meta,
        suggested_tasks=tasks,
        potential_targets=targets
    )

    return df, meta