from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from kafka import KafkaConsumer, KafkaProducer

from falcon.decision import FalconDecisionEngine
from falcon.schema import TransactionEvent


class KafkaDecisionWorker:
    """At-least-once Kafka worker for transaction -> decision streaming.

    The input offset is committed only after the decision has been persisted and
    the output event has been acknowledged by Kafka. Falcon decisions are
    idempotent by transaction_id, so replay after a worker crash is safe.
    """

    def __init__(
        self,
        state_dir: str | Path,
        *,
        bootstrap_servers: str = "localhost:9092",
        input_topic: str = "falcon.transactions",
        output_topic: str = "falcon.decisions",
        group_id: str = "falcon-decision-engine",
    ):
        self.engine = FalconDecisionEngine(state_dir)
        servers = [item.strip() for item in bootstrap_servers.split(",") if item.strip()]
        self.input_topic = input_topic
        self.output_topic = output_topic
        self.consumer = KafkaConsumer(
            input_topic,
            bootstrap_servers=servers,
            group_id=group_id,
            enable_auto_commit=False,
            auto_offset_reset="earliest",
            value_deserializer=lambda value: json.loads(value.decode("utf-8")),
        )
        self.producer = KafkaProducer(
            bootstrap_servers=servers,
            acks="all",
            value_serializer=lambda value: json.dumps(value, sort_keys=True).encode("utf-8"),
        )

    def process_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        event = TransactionEvent(**payload)
        return self.engine.decide(event).model_dump(mode="json")

    def run_forever(self) -> None:
        for message in self.consumer:
            decision = self.process_payload(message.value)
            future = self.producer.send(
                self.output_topic,
                key=decision["transaction_id"].encode("utf-8"),
                value=decision,
            )
            future.get(timeout=10)
            self.consumer.commit()
