from __future__ import annotations

from pathlib import Path
from typing import Any
from uuid import uuid4

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from .monitoring import build_reference_profile
from .registry import ModelRegistry
from .tracking import ExperimentTracker
from .validation import DatasetValidator, TaskType


class ForgeTrainer:
    """Validate, train, evaluate, track and register a model as one lifecycle transaction."""

    def __init__(
        self,
        *,
        workdir: str | Path,
        tracker: ExperimentTracker,
        registry: ModelRegistry,
        validator: DatasetValidator | None = None,
    ):
        self.workdir = Path(workdir)
        self.workdir.mkdir(parents=True, exist_ok=True)
        self.tracker = tracker
        self.registry = registry
        self.validator = validator or DatasetValidator()

    @staticmethod
    def _preprocessor(features: pd.DataFrame) -> ColumnTransformer:
        numeric = [column for column in features.columns if pd.api.types.is_numeric_dtype(features[column])]
        categorical = [column for column in features.columns if column not in numeric]

        transformers = []
        if numeric:
            transformers.append(
                (
                    "numeric",
                    Pipeline(
                        [
                            ("imputer", SimpleImputer(strategy="median")),
                            ("scale", StandardScaler()),
                        ]
                    ),
                    numeric,
                )
            )
        if categorical:
            transformers.append(
                (
                    "categorical",
                    Pipeline(
                        [
                            ("imputer", SimpleImputer(strategy="most_frequent")),
                            (
                                "encode",
                                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                            ),
                        ]
                    ),
                    categorical,
                )
            )
        return ColumnTransformer(transformers=transformers, remainder="drop")

    @staticmethod
    def _estimator(task: TaskType, random_state: int):
        if task == "classification":
            return LogisticRegression(max_iter=1500, class_weight="balanced", random_state=random_state)
        return RandomForestRegressor(
            n_estimators=160,
            random_state=random_state,
            n_jobs=-1,
            min_samples_leaf=2,
        )

    def train(
        self,
        df: pd.DataFrame,
        *,
        target: str,
        model_name: str = "forgeml-model",
        task: TaskType | None = None,
        test_size: float = 0.20,
        random_state: int = 42,
    ) -> dict[str, Any]:
        report = self.validator.validate(df, target, task)
        if not report.valid:
            raise ValueError("Dataset validation failed: " + "; ".join(report.issues))

        params = {
            "test_size": float(test_size),
            "random_state": int(random_state),
            "algorithm": "logistic_regression" if report.task == "classification" else "random_forest_regressor",
        }
        run_id = self.tracker.start_run(
            model_name=model_name,
            task=report.task,
            data_fingerprint=report.data_fingerprint,
            params=params,
        )

        artifact_path = self.workdir / f"{model_name}-{run_id}.joblib"
        try:
            X = df.drop(columns=[target]).copy()
            y = df[target].copy()
            stratify = y if report.task == "classification" and y.value_counts().min() >= 2 else None
            X_train, X_test, y_train, y_test = train_test_split(
                X,
                y,
                test_size=test_size,
                random_state=random_state,
                stratify=stratify,
            )

            pipeline = Pipeline(
                [
                    ("preprocess", self._preprocessor(X_train)),
                    ("model", self._estimator(report.task, random_state)),
                ]
            )
            pipeline.fit(X_train, y_train)
            predictions = pipeline.predict(X_test)
            if report.task == "classification":
                metric_name = "f1_weighted"
                metric_value = float(f1_score(y_test, predictions, average="weighted"))
            else:
                metric_name = "r2"
                metric_value = float(r2_score(y_test, predictions))

            bundle = {
                "format_version": 1,
                "model_name": model_name,
                "run_id": run_id,
                "task": report.task,
                "target": target,
                "feature_names": list(X.columns),
                "pipeline": pipeline,
                "reference_profile": build_reference_profile(X_train),
                "metric_name": metric_name,
                "metric_value": metric_value,
                "data_fingerprint": report.data_fingerprint,
                "validation": report.to_dict(),
                "training_params": params,
            }
            joblib.dump(bundle, artifact_path)

            version = self.registry.register(
                model_name=model_name,
                run_id=run_id,
                source_artifact=artifact_path,
                metric_name=metric_name,
                metric_value=metric_value,
                metadata={
                    "task": report.task,
                    "target": target,
                    "data_fingerprint": report.data_fingerprint,
                    "validation_warnings": report.warnings,
                },
                stage="candidate",
            )
            self.tracker.complete_run(
                run_id,
                metric_name=metric_name,
                metric_value=metric_value,
                artifact_uri=version["artifact_uri"],
            )
            artifact_path.unlink(missing_ok=True)
            return {
                "run_id": run_id,
                "model_name": model_name,
                "version": version["version"],
                "stage": version["stage"],
                "task": report.task,
                "metric_name": metric_name,
                "metric_value": metric_value,
                "data_fingerprint": report.data_fingerprint,
                "validation": report.to_dict(),
            }
        except Exception as exc:
            self.tracker.fail_run(run_id, str(exc))
            artifact_path.unlink(missing_ok=True)
            raise
