from __future__ import annotations

from pathlib import Path
from typing import Any

from falcon.storage import DecisionStore
from forgeml.registry import ModelRegistry


class FalconReleaseController:
    def __init__(self, state_dir: str | Path):
        root = Path(state_dir)
        self.registry = ModelRegistry(root / "registry")
        self.store = DecisionStore(root / "falcon.db")

    def configure_experiment(self, challenger_version: int | None, traffic_percent: int, mode: str) -> dict[str, Any]:
        if challenger_version is not None:
            candidate = self.registry.get("falcon-risk", challenger_version)
            production = self.registry.resolve("falcon-risk", "production")
            if int(candidate["version"]) == int(production["version"]):
                raise ValueError("Production model cannot be its own challenger")
        return self.store.set_experiment(challenger_version, traffic_percent, mode)

    def promote(self, challenger_version: int) -> dict[str, Any]:
        previous = self.registry.resolve("falcon-risk", "production")
        challenger = self.registry.get("falcon-risk", challenger_version)
        if int(challenger["version"]) == int(previous["version"]):
            raise ValueError("Version is already production")
        promoted = self.registry.promote("falcon-risk", challenger_version, "production")
        self.store.set_experiment(None, 0, "shadow")
        return {
            "previous_version": int(previous["version"]),
            "production_version": int(promoted["version"]),
            "rollback_command": f"rollback:{int(previous['version'])}",
        }

    def rollback(self, version: int) -> dict[str, Any]:
        current = self.registry.resolve("falcon-risk", "production")
        target = self.registry.get("falcon-risk", version)
        if int(target["version"]) == int(current["version"]):
            raise ValueError("Version is already production")
        restored = self.registry.promote("falcon-risk", version, "production")
        self.store.set_experiment(None, 0, "shadow")
        return {
            "rolled_back_from": int(current["version"]),
            "production_version": int(restored["version"]),
        }
