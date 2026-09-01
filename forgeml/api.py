from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .deployment import DeploymentManager
from .monitoring import compute_drift
from .registry import ModelRegistry


class PredictRequest(BaseModel):
    features: dict[str, object]
    request_id: str | None = None


class MonitorRequest(BaseModel):
    rows: list[dict[str, object]] = Field(min_length=1)
    threshold: float = Field(default=0.20, ge=0.0)


class StableDeployRequest(BaseModel):
    model_name: str
    version: int = Field(ge=1)


class CanaryRequest(BaseModel):
    model_name: str
    challenger_version: int = Field(ge=1)
    fraction: float = Field(gt=0.0, lt=1.0)


def create_app(home: str | Path | None = None) -> FastAPI:
    root = Path(home or os.getenv("FORGEML_HOME", ".forgeml"))
    registry = ModelRegistry(root / "registry")
    deployments = DeploymentManager(root / "deployments.db")
    app = FastAPI(title="ForgeML Model Serving API", version="1.0.0")

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "forgeml-serving"}

    @app.post("/predict/{model_name}")
    def predict(model_name: str, body: PredictRequest):
        request_id = body.request_id or str(uuid4())
        try:
            version = deployments.route(model_name, request_id)
            record = registry.get(model_name, version)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Model or deployment not found") from exc

        bundle = joblib.load(record["artifact_uri"])
        frame = pd.DataFrame([body.features])
        missing = [feature for feature in bundle["feature_names"] if feature not in frame.columns]
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing features: {', '.join(missing)}")
        frame = frame[bundle["feature_names"]]
        prediction = bundle["pipeline"].predict(frame)[0]
        if hasattr(prediction, "item"):
            prediction = prediction.item()

        response = {
            "request_id": request_id,
            "model_name": model_name,
            "version": version,
            "prediction": prediction,
        }
        if bundle["task"] == "classification" and hasattr(bundle["pipeline"], "predict_proba"):
            probabilities = bundle["pipeline"].predict_proba(frame)[0]
            response["probabilities"] = [float(value) for value in probabilities]
        return response

    @app.post("/monitor/{model_name}")
    def monitor(model_name: str, body: MonitorRequest):
        try:
            version = deployments.current(model_name)["stable_version"]
            record = registry.get(model_name, int(version))
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Model or deployment not found") from exc
        bundle = joblib.load(record["artifact_uri"])
        frame = pd.DataFrame(body.rows)
        return {
            "model_name": model_name,
            "version": int(version),
            **compute_drift(bundle["reference_profile"], frame, threshold=body.threshold),
        }

    @app.post("/deploy/stable")
    def deploy_stable(body: StableDeployRequest):
        try:
            registry.get(body.model_name, body.version)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Registered model version not found") from exc
        registry.promote(body.model_name, body.version, "production")
        return deployments.set_stable(body.model_name, body.version)

    @app.post("/deploy/canary")
    def deploy_canary(body: CanaryRequest):
        try:
            registry.get(body.model_name, body.challenger_version)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Registered challenger version not found") from exc
        registry.promote(body.model_name, body.challenger_version, "staging")
        return deployments.start_canary(body.model_name, body.challenger_version, body.fraction)

    @app.post("/deploy/{model_name}/promote-canary")
    def promote_canary(model_name: str):
        try:
            state = deployments.current(model_name)
            challenger = state.get("challenger_version")
            if challenger is None:
                raise ValueError("No active canary")
            registry.promote(model_name, int(challenger), "production")
            return deployments.promote_canary(model_name)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Deployment not found") from exc
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    @app.post("/deploy/{model_name}/rollback")
    def rollback(model_name: str):
        try:
            state = deployments.rollback(model_name)
            registry.promote(model_name, int(state["stable_version"]), "production")
            return state
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Deployment not found") from exc
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    @app.get("/deploy/{model_name}")
    def deployment_state(model_name: str):
        try:
            return deployments.current(model_name)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Deployment not found") from exc

    return app


app = create_app()
