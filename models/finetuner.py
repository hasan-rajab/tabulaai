import pandas as pd
import numpy as np
import joblib
from pathlib import Path

from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    r2_score,
    mean_squared_error,
    mean_absolute_error
)

MODEL_DIR = Path(__file__).parent / "pretrained"


def align_features(X: pd.DataFrame, n_features: int = 200) -> pd.DataFrame:
    if X.shape[1] < n_features:
        pad = pd.DataFrame(
            np.zeros((len(X), n_features - X.shape[1])),
            columns=[f"pad_{i}" for i in range(n_features - X.shape[1])]
        )
        X = pd.concat([X.reset_index(drop=True), pad], axis=1)
    else:
        X = X.iloc[:, :n_features]

    X.columns = [f"f_{i}" for i in range(n_features)]
    return X


def finetune_models(df, target_col, task, n_estimators_ft=100):
    X = df.drop(columns=[target_col]).copy()
    y = df[target_col]

    for col in X.select_dtypes(include=["object", "category"]).columns:
        le = LabelEncoder()
        X[col] = le.fit_transform(X[col].astype(str))

    X = pd.DataFrame(SimpleImputer(strategy="median").fit_transform(X))
    X = pd.DataFrame(StandardScaler().fit_transform(X))
    X = align_features(X)

    results = {}

    if task == "classification":
        le_target = LabelEncoder()
        y = pd.Series(le_target.fit_transform(y))

    try:
        X_tr, X_val, y_tr, y_val = train_test_split(
            X, y, test_size=0.2, random_state=42,
            stratify=y if task == "classification" else None
        )
    except ValueError:
        # Fallback if stratify fails due to small class sizes
        X_tr, X_val, y_tr, y_val = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

    X_tr = X_tr.reset_index(drop=True)
    X_val = X_val.reset_index(drop=True)
    y_tr = y_tr.reset_index(drop=True)
    y_val = y_val.reset_index(drop=True)

    # For classification, remap labels to contiguous integers after split
    if task == "classification":
        le_remap = LabelEncoder()
        y_tr = pd.Series(le_remap.fit_transform(y_tr))
        # Drop val rows with unseen classes; if this empties val, fall back to train
        mask = y_val.isin(le_remap.classes_)
        X_val = X_val[mask].reset_index(drop=True)
        y_val = y_val[mask].reset_index(drop=True)
        if len(y_val) == 0:
            # Fall back to using training set for validation
            X_val = X_tr.copy()
            y_val = y_tr.copy()
        else:
            y_val = pd.Series(le_remap.transform(y_val))

    X_tr = X_tr.reset_index(drop=True)
    X_val = X_val.reset_index(drop=True)
    y_tr = y_tr.reset_index(drop=True)
    y_val = y_val.reset_index(drop=True)

    if task == "classification":
        from xgboost import XGBClassifier

        xgb_ft = XGBClassifier(
            n_estimators=n_estimators_ft,
            max_depth=7,
            learning_rate=0.03,
            subsample=0.8,
            colsample_bytree=0.7,
            min_child_weight=3,
            gamma=0.1,
            reg_alpha=0.1,
            reg_lambda=1.0,
            tree_method="hist",
            device="cpu",
            random_state=42,
            eval_metric="mlogloss"
        )
        xgb_ft.fit(X_tr, y_tr)

        from lightgbm import LGBMClassifier

        lgbm_ft = LGBMClassifier(
            n_estimators=n_estimators_ft,
            max_depth=7,
            learning_rate=0.03,
            subsample=0.8,
            colsample_bytree=0.7,
            min_child_samples=20,
            reg_alpha=0.1,
            reg_lambda=1.0,
            class_weight="balanced",
            device="cpu",
            random_state=42,
            verbose=-1
        )
        lgbm_ft.fit(X_tr, y_tr)

        from catboost import CatBoostClassifier

        cat_ft = CatBoostClassifier(
            iterations=n_estimators_ft,
            depth=7,
            learning_rate=0.03,
            l2_leaf_reg=3,
            task_type="CPU",
            random_seed=42,
            verbose=0
        )
        cat_ft.fit(X_tr, y_tr)

        try:
            from tabpfn import TabPFNClassifier

            tabpfn = TabPFNClassifier(
                device="cpu",
                N_ensemble_configurations=16
            )
            tabpfn.fit(
                X_tr.values[:1000],
                y_tr.values[:1000]
            )
            has_tabpfn = True
        except:
            has_tabpfn = False

        for name, model in [
            ("XGBoost", xgb_ft),
            ("LightGBM", lgbm_ft),
            ("CatBoost", cat_ft)
        ]:
            preds = model.predict(X_val)

            results[name] = {
                "model": model,
                "accuracy": round(
                    accuracy_score(y_val, preds), 4
                ),
                "f1_weighted": round(
                    f1_score(
                        y_val,
                        preds,
                        average="weighted",
                        zero_division=0
                    ),
                    4
                ),
                "f1_macro": round(
                    f1_score(
                        y_val,
                        preds,
                        average="macro",
                        zero_division=0
                    ),
                    4
                ),
                "predictions": preds,
                "probabilities": model.predict_proba(X_val)
            }

        if has_tabpfn:
            preds = tabpfn.predict(X_val)

            results["TabPFN"] = {
                "model": tabpfn,
                "accuracy": round(
                    accuracy_score(y_val, preds), 4
                ),
                "f1_weighted": round(
                    f1_score(
                        y_val,
                        preds,
                        average="weighted",
                        zero_division=0
                    ),
                    4
                ),
                "f1_macro": round(
                    f1_score(
                        y_val,
                        preds,
                        average="macro",
                        zero_division=0
                    ),
                    4
                ),
                "predictions": preds,
                "probabilities": tabpfn.predict_proba(X_val)
            }

        try:
            meta_train_feats = np.column_stack([
                xgb_ft.predict_proba(X_tr),
                lgbm_ft.predict_proba(X_tr),
                cat_ft.predict_proba(X_tr)
            ])

            meta_val_feats = np.column_stack([
                xgb_ft.predict_proba(X_val),
                lgbm_ft.predict_proba(X_val),
                cat_ft.predict_proba(X_val)
            ])

            from sklearn.linear_model import LogisticRegression

            meta_ft = LogisticRegression(
                max_iter=1000,
                class_weight="balanced"
            )

            meta_ft.fit(meta_train_feats, y_tr)

            stack_preds = meta_ft.predict(meta_val_feats)

            results["Stacking"] = {
                "model": meta_ft,
                "accuracy": round(
                    accuracy_score(y_val, stack_preds), 4
                ),
                "f1_weighted": round(
                    f1_score(
                        y_val,
                        stack_preds,
                        average="weighted",
                        zero_division=0
                    ),
                    4
                ),
                "f1_macro": round(
                    f1_score(
                        y_val,
                        stack_preds,
                        average="macro",
                        zero_division=0
                    ),
                    4
                ),
                "predictions": stack_preds,
            }
        except:
            pass

        results["_val"] = {
            "X_val": X_val,
            "y_val": y_val
        }

        results["_label_encoder"] = le_target

    elif task == "regression":
        from xgboost import XGBRegressor

        xgb_ft = XGBRegressor(
            n_estimators=n_estimators_ft,
            max_depth=7,
            learning_rate=0.03,
            subsample=0.8,
            colsample_bytree=0.7,
            reg_alpha=0.1,
            reg_lambda=1.0,
            tree_method="hist",
            device="cpu",
            random_state=42
        )

        xgb_ft.fit(X_tr, y_tr)

        from lightgbm import LGBMRegressor

        lgbm_ft = LGBMRegressor(
            n_estimators=n_estimators_ft,
            max_depth=7,
            learning_rate=0.03,
            subsample=0.8,
            colsample_bytree=0.7,
            reg_alpha=0.1,
            reg_lambda=1.0,
            device="cpu",
            random_state=42,
            verbose=-1
        )

        lgbm_ft.fit(X_tr, y_tr)

        from catboost import CatBoostRegressor

        cat_ft = CatBoostRegressor(
            iterations=n_estimators_ft,
            depth=6,
            learning_rate=0.03,
            task_type="CPU",
            random_seed=42,
            verbose=0
        )

        cat_ft.fit(X_tr, y_tr)

        for name, model in [
            ("XGBoost", xgb_ft),
            ("LightGBM", lgbm_ft),
            ("CatBoost", cat_ft)
        ]:
            preds = model.predict(X_val)

            results[name] = {
                "model": model,
                "r2": round(
                    r2_score(y_val, preds), 4
                ),
                "rmse": round(
                    np.sqrt(
                        mean_squared_error(
                            y_val,
                            preds
                        )
                    ),
                    4
                ),
                "mae": round(
                    mean_absolute_error(
                        y_val,
                        preds
                    ),
                    4
                ),
                "predictions": preds
            }

        results["_val"] = {
            "X_val": X_val,
            "y_val": y_val
        }

    return results