import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.impute import SimpleImputer

def preprocess(df: pd.DataFrame, meta, target_col: str = None):
    df = df.copy()
    encoders = {}
    scalers = {}

    for col, cmeta in meta.columns.items():
        if col not in df.columns:
            continue

        if cmeta.missing_pct > 60:
            df.drop(columns=[col], inplace=True)
            continue

        if cmeta.dtype == "numeric":
            imp = SimpleImputer(strategy="median")
            df[col] = imp.fit_transform(df[[col]])
            if col != target_col:
                scaler = StandardScaler()
                df[col] = scaler.fit_transform(df[[col]])
                scalers[col] = scaler

        elif cmeta.dtype == "categorical":
            df[col] = df[col].fillna("missing")
            le = LabelEncoder()
            df[col] = le.fit_transform(df[col].astype(str))
            encoders[col] = le

        elif cmeta.dtype == "datetime":
            df[col] = pd.to_datetime(df[col], errors="coerce")
            df[f"{col}_year"]  = df[col].dt.year
            df[f"{col}_month"] = df[col].dt.month
            df[f"{col}_day"]   = df[col].dt.day
            df.drop(columns=[col], inplace=True)

        elif cmeta.dtype == "text":
            df.drop(columns=[col], inplace=True)

    return df, {"encoders": encoders, "scalers": scalers}