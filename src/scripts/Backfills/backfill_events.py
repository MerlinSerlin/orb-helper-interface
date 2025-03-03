import shortuuid
import random
import time
from orb import Orb
import os

EXTERNAL_CUSTOMER_ID = "hover_demo_customer"
ORG_NAME = "orb_generated"
BATCH_SIZE = 400

client = Orb(
    api_key=os.environ["ORB_API_KEY"],
)


def batch(iterable, n=1):
    """
    Create batches
    From: https://stackoverflow.com/questions/8290397/how-to-split-an-iterable-in-constant-size-chunks
    """
    length = len(iterable)
    for ndx in range(0, length, n):
        yield iterable[ndx: min(ndx + n, length)]


def generate_idempotency_key():
    return f"{ORG_NAME}_demo_{generate_string_id()}"


def generate_string_id():
    return shortuuid.uuid()[:16]


def generate_timestamp(month, day, year):
    return f"{year}-{month:02}-{day:02}T20:08:19Z"


def generate_api_request_event(month, day, year):
    return {
        "external_customer_id": "hover_demo_customer",
        "event_name": "photo_processed",
        "timestamp": generate_timestamp(month, day, year),
        "idempotency_key": generate_idempotency_key(),
        "properties": {
            "complexity": random.choice(["simple", "average", "complex"]),
            "type": "roof_only_from_photos"
        },
    }


def ingest_batch(events, timeframe_start, timeframe_end):
    backfill = client.events.backfills.create(
        timeframe_start=timeframe_start,
        timeframe_end=timeframe_end,
        external_customer_id=EXTERNAL_CUSTOMER_ID,
        replace_existing_events=True,
    )

    print(f"Opened backfill {backfill.id}")

    num_batches_processed = 1
    for curr_batch in batch(events, BATCH_SIZE):
        result = client.events.ingest(
            events=curr_batch,
            backfill_id=backfill.id
        )
        if len(result.validation_failed) > 0:
            print("Batch failed to process")
            exit()
        else:
            print(f"Batch {num_batches_processed} processed")
        num_batches_processed += 1
        time.sleep(10)

    client.events.backfills.close(backfill.id)

    # wait until backfill is reflected
    while True:
        if not client.events.backfills.fetch(backfill.id).status == "reflected":
            time.sleep(5)
        else:
            break

    print("Events in batch successfully ingested")


def generate_and_ingest_batch(month, year, start_day, end_day, num_events=100):
    events = []
    # Generate events for each day in the range
    for day_idx in range(start_day, end_day + 1):
        events.extend([
            *[generate_api_request_event(month, day_idx, year) for i in range(random.randint(int(num_events / 2), num_events))],
        ])
    # Ingest the batch
    ingest_batch(
        events,
        f"{year}-{month:02}-{start_day:02}T00:00:00.000Z",
        f"{year}-{month:02}-{end_day:02}T23:59:59.000Z",
    )


if __name__ == "__main__":
    backfills = client.events.backfills.list()
    while not all([backfill.status not in ["pending", "pending_revert"] for backfill in backfills]):
        for backfill in backfills:
            if backfill.status == "pending":
                client.events.backfills.revert(backfill.id)
        time.sleep(5)
        backfills = client.events.backfills.list()

    # January 2025 (break into 10-day chunks)
    generate_and_ingest_batch(1, 2025, 15, 20, num_events=100)  # 10 days
    generate_and_ingest_batch(1, 2025, 21, 30, num_events=100)  # 10 days
    generate_and_ingest_batch(1, 2025, 31, 31, num_events=100)  # 1 day

    # February 2025 (up to mid-February)
    generate_and_ingest_batch(2, 2025, 1, 10, num_events=100)
    generate_and_ingest_batch(2, 2025, 11, 15, num_events=100)
