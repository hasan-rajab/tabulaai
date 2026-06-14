import shap
import numpy as np
import pandas as pd

def get_shap_values(model, X_val: pd.DataFrame, model_name: str, task: str):
    """
    Returns SHAP values for a given model and validation set.
    Handles XGBoost, LightGBM, CatBoost differently.
    """
    try:
        if model_name in ["XGBoost", "LightGBM"]:
            explainer = shap.TreeExplainer(model)
            shap_values = explainer.shap_values(X_val)

        elif model_name == "CatBoost":
            explainer = shap.TreeExplainer(model)
            shap_values = explainer.shap_values(X_val)

        else:
            # Fallback for Stacking/LogReg — use KernelExplainer on small sample
            background = shap.sample(X_val, min(50, len(X_val)))
            explainer = shap.KernelExplainer(model.predict_proba
                                             if task == "classification"
                                             else model.predict, background)
            shap_values = explainer.shap_values(X_val.iloc[:20])

        return explainer, shap_values

    except Exception as e:
        return None, None


def get_feature_importance(shap_values, feature_names: list, task: str) -> pd.DataFrame:
    """
    Returns mean absolute SHAP values per feature as a DataFrame.
    Handles both multiclass (3D) and binary/regression (2D) cases.
    """
    try:
        # Handle list of arrays (LightGBM/XGBoost multiclass) first
        if isinstance(shap_values, list):
            sv = np.abs(np.array(shap_values))
            if sv.ndim == 3:
                importance = sv.mean(axis=(0, 1))
            else:
                importance = sv.mean(axis=0)
        else:
            sv = np.array(shap_values)
            if sv.ndim == 3:
                importance = np.abs(sv).mean(axis=(0, 1))
            elif sv.ndim == 2:
                importance = np.abs(sv).mean(axis=0)
            else:
                importance = np.abs(sv)

        importance = importance[:len(feature_names)]

        return pd.DataFrame({
            "Feature": feature_names[:len(importance)],
            "Importance": importance
        }).sort_values("Importance", ascending=False).reset_index(drop=True)

    except Exception as e:
        return pd.DataFrame({
            "Feature": feature_names,
            "Importance": [0.0] * len(feature_names)
        })