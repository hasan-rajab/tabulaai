from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import json
import math
from typing import Literal

import pandas as pd

TaskType = Literal["classification", "regression"]


@dataclass(frozen=True)
class ValidationReport:
    valid: bool
    rows: int
    columns: int
    target: str
    task: TaskType
    duplicate_rows: int
    max_feature_missing_fraction: float
    data_fingerprint: str
    issues: list[str]
    warnings: list[str]

    def to_dict(self) -> dict:
        return asdict(self)


class DatasetValidator:
    """Fail-fast validation for training data before an experiment starts."""

    def __init__(self, min_rows: int = 50, max_feature_missing_fraction: float = 0.80):
        self.min_rows = min_rows
        self.max_feature_missing_fraction = max_feature_missing_fraction

    @staticmethod
    def infer_task(target: pd.Series) -> TaskType:
        non_null = target.dropna()
        unique = int(non_null.nunique())
        threshold = max(20, int(math.sqrt(max(len(non_null), 1))))
        if (
            pd.api.types.is_bool_dtype(non_null)
            or pd.api.types.is_object_dtype(non_null)
            or pd.api.types.is_categorical_dtype(non_null.dtype)
            or unique <= threshold
        ):
            return "classification"
        return "regression"

    @staticmethod
    def fingerprint(df: pd.DataFrame) -> str:
        ordered = df.copy()
        schema = [(str(col), str(dtype)) for col, dtype in ordered.dtypes.items()]
        row_hashes = pd.util.hash_pandas_object(ordered, index=True).astype("uint64").tolist()
        payload = json.dumps({"schema": schema, "rows": row_hashes}, sort_keys=True).encode("utf-8")
        return hashlib.sha256(payload).hexdigest()

    def validate(
        self,
        df: pd.DataFrame,
        target: str,
        task: TaskType | None = None,
    ) -> ValidationReport:
        issues: list[str] = []
        warnings: list[str] = []

        if target not in df.columns:
            raise ValueError(f"Target column '{target}' is not present in the dataset")
        if df.empty:
            raise ValueError("Dataset is empty")

        resolved_task = task or self.infer_task(df[target])
        if len(df) < self.min_rows:
            issues.append(f"Dataset has {len(df)} rows; minimum is {self.min_rows}")

        if df[target].isna().any():
            issues.append("Target contains missing values")

        feature_columns = [column for column in df.columns if column != target]
        if not feature_columns:
            issues.append("Dataset has no feature columns")

        missing = df[feature_columns].isna().mean() if feature_columns else pd.Series(dtype=float)
        max_missing = float(missing.max()) if len(missing) else 0.0
        for column, fraction in missing.items():
            if fraction >= self.max_feature_missing_fraction:
                issues.append(
                    f"Feature '{column}' is {fraction:.1%} missing; limit is "
                    f"{self.max_feature_missing_fraction:.1%}"
                )
            elif fraction >= 0.30:
                warnings.append(f"Feature '{column}' is {fraction:.1%} missing")

        duplicate_rows = int(df.duplicated().sum())
        if duplicate_rows:
            warnings.append(f"Dataset contains {duplicate_rows} duplicate rows")

        target_unique = int(df[target].dropna().nunique())
        if resolved_task == "classification":
            if target_unique < 2:
                issues.append("Classification target must contain at least two classes")
            class_counts = df[target].value_counts(dropna=True)
            if not class_counts.empty and int(class_counts.min()) < 2:
                issues.append("Every classification class needs at least two examples")
        elif not pd.api.types.is_numeric_dtype(df[target]):
            issues.append("Regression target must be numeric")

        all_null = [column for column in feature_columns if df[column].isna().all()]
        for column in all_null:
            issues.append(f"Feature '{column}' contains only missing values")

        constant = [column for column in feature_columns if df[column].nunique(dropna=True) <= 1]
        if constant:
            warnings.append("Constant features: " + ", ".join(map(str, constant)))

        return ValidationReport(
            valid=not issues,
            rows=len(df),
            columns=len(df.columns),
            target=target,
            task=resolved_task,
            duplicate_rows=duplicate_rows,
            max_feature_missing_fraction=max_missing,
            data_fingerprint=self.fingerprint(df),
            issues=issues,
            warnings=warnings,
        )
