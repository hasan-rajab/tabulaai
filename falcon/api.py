from __future__ import annotations

import os
import time
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import HTMLResponse, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from pydantic import BaseModel, Field

from falcon.control import FalconReleaseController
from falcon.decision import FalconDecisionEngine
from falcon.monitoring import FalconMonitor
from falcon.retraining import RetrainingAdvisor, retrain_from_feedback
from falcon.schema import FeedbackEvent, RiskDecision, TransactionEvent

DECISION_COUNTER = Counter(
    "falcon_decisions_total",
    "Falcon risk decisions",
    ["decision", "model_role"],
)
DECISION_LATENCY = Histogram(
    "falcon_decision_latency_seconds",
    "Falcon end-to-end synchronous decision latency",
)


class ExperimentRequest(BaseModel):
    challenger_version: int | None = Field(default=None, ge=1)
    traffic_percent: int = Field(default=0, ge=0, le=100)
    mode: str = "shadow"


class RetrainRequest(BaseModel):
    min_labels: int = Field(default=200, ge=50, le=100_000)


def _admin_guard(x_admin_key: str | None = Header(default=None)) -> None:
    configured = os.getenv("FALCON_ADMIN_KEY")
    if configured and x_admin_key != configured:
        raise HTTPException(status_code=403, detail="Invalid Falcon admin key")


def _dashboard_html() -> str:
    return """<!doctype html>
<html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>
<title>Falcon Decision Console</title>
<style>
body{font-family:Inter,system-ui,sans-serif;margin:0;background:#0b1020;color:#e9eefb}main{max-width:1180px;margin:auto;padding:28px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}.card{background:#151d33;border:1px solid #26314f;border-radius:14px;padding:18px}
h1{margin:0 0 6px}small,.muted{color:#93a4c7}.value{font-size:28px;font-weight:700;margin-top:6px}table{width:100%;border-collapse:collapse;margin-top:20px;background:#151d33;border-radius:14px;overflow:hidden}
th,td{text-align:left;padding:11px;border-bottom:1px solid #26314f;font-size:13px}.approve{color:#62d89b}.step_up{color:#f2c96d}.manual_review{color:#ff7e8a}
code{color:#b7c7ff}</style></head>
<body><main><h1>Falcon</h1><p class='muted'>Real-time AI transaction risk decisioning · champion/challenger · drift · feedback</p>
<div class='grid'><div class='card'><small>Production model</small><div class='value' id='model'>—</div></div>
<div class='card'><small>Experiment</small><div class='value' id='experiment'>—</div></div>
<div class='card'><small>Max PSI</small><div class='value' id='psi'>—</div></div>
<div class='card'><small>Labeled outcomes</small><div class='value' id='labels'>—</div></div></div>
<table><thead><tr><th>Transaction</th><th>Decision</th><th>Risk</th><th>Model</th><th>Champion</th><th>Challenger</th></tr></thead><tbody id='rows'></tbody></table>
<script>
async function refresh(){const r=await fetch('/dashboard/data'); const d=await r.json();
document.getElementById('model').textContent='v'+(d.production_version??'—');
document.getElementById('experiment').textContent=d.experiment.traffic_percent+'% '+d.experiment.mode;
document.getElementById('psi').textContent=(d.monitoring.drift.max_psi??0).toFixed(3);
document.getElementById('labels').textContent=d.monitoring.experiment.labeled_count??0;
document.getElementById('rows').innerHTML=d.decisions.map(x=>`<tr><td><code>${x.transaction_id}</code></td><td class='${x.decision}'>${x.decision}</td><td>${Number(x.risk_score).toFixed(3)}</td><td>${x.model_role} v${x.model_version}</td><td>${Number(x.champion_score).toFixed(3)}</td><td>${x.challenger_score==null?'—':Number(x.challenger_score).toFixed(3)}</td></tr>`).join('');}
refresh(); setInterval(refresh,3000);
</script></main></body></html>"""


def create_app(state_dir: str | Path | None = None) -> FastAPI:
    root = Path(state_dir or os.getenv("FALCON_STATE_DIR", ".falcon_state"))
    engine = FalconDecisionEngine(root)
    monitor = FalconMonitor(root)
    controller = FalconReleaseController(root)
    advisor = RetrainingAdvisor(root)

    app = FastAPI(title="Falcon Real-Time Decisioning", version="1.0.0")

    @app.get("/", response_class=HTMLResponse)
    def dashboard():
        return _dashboard_html()

    @app.get("/health")
    def health():
        try:
            production = engine.registry.resolve("falcon-risk", "production")
            return {"status": "ok", "ready": True, "production_version": production["version"]}
        except KeyError:
            return {"status": "degraded", "ready": False, "reason": "no_production_model"}

    @app.post("/decide", response_model=RiskDecision)
    def decide(event: TransactionEvent):
        started = time.perf_counter()
        try:
            result = engine.decide(event)
        except KeyError as exc:
            raise HTTPException(status_code=503, detail="Falcon has no production model") from exc
        DECISION_COUNTER.labels(result.decision, result.model_role).inc()
        DECISION_LATENCY.observe(time.perf_counter() - started)
        return result

    @app.post("/feedback")
    def feedback(body: FeedbackEvent):
        try:
            return engine.store.record_feedback(body)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Decision not found") from exc

    @app.get("/decisions")
    def decisions(limit: int = 100):
        return engine.store.recent_decisions(max(1, min(limit, 1000)))

    @app.get("/monitoring")
    def monitoring():
        return monitor.snapshot()

    @app.get("/models")
    def models():
        return engine.registry.list_versions("falcon-risk")

    @app.get("/experiment")
    def experiment():
        return engine.store.get_experiment()

    @app.get("/dashboard/data")
    def dashboard_data():
        try:
            version = engine.registry.resolve("falcon-risk", "production")["version"]
        except KeyError:
            version = None
        return {
            "production_version": version,
            "experiment": engine.store.get_experiment(),
            "monitoring": monitor.snapshot(),
            "decisions": engine.store.recent_decisions(50),
        }

    @app.post("/admin/experiment", dependencies=[Depends(_admin_guard)])
    def configure_experiment(body: ExperimentRequest):
        try:
            return controller.configure_experiment(body.challenger_version, body.traffic_percent, body.mode)
        except (KeyError, ValueError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/admin/promote/{version}", dependencies=[Depends(_admin_guard)])
    def promote(version: int):
        try:
            engine._bundle_cache.clear()
            return controller.promote(version)
        except (KeyError, ValueError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/admin/rollback/{version}", dependencies=[Depends(_admin_guard)])
    def rollback(version: int):
        try:
            engine._bundle_cache.clear()
            return controller.rollback(version)
        except (KeyError, ValueError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.get("/admin/retraining/recommendation", dependencies=[Depends(_admin_guard)])
    def retraining_recommendation():
        return advisor.recommend()

    @app.post("/admin/retrain", dependencies=[Depends(_admin_guard)])
    def retrain(body: RetrainRequest):
        try:
            return retrain_from_feedback(root, min_labels=body.min_labels)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.get("/metrics")
    def metrics():
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    return app


app = create_app()
