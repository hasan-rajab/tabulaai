from falcon.streaming import KafkaDecisionWorker


class FakeConsumer:
    def __init__(self):
        self.offsets = None

    def commit(self, *, offsets):
        self.offsets = offsets


class FakeMessage:
    topic = "falcon.transactions"
    partition = 2
    offset = 41


def test_commit_is_scoped_to_completed_partition_and_next_offset():
    worker = KafkaDecisionWorker.__new__(KafkaDecisionWorker)
    worker.consumer = FakeConsumer()

    worker._commit_message(FakeMessage())

    assert len(worker.consumer.offsets) == 1
    partition, offset_meta = next(iter(worker.consumer.offsets.items()))
    assert partition.topic == "falcon.transactions"
    assert partition.partition == 2
    assert offset_meta.offset == 42
