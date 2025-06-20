import json
import random
import time
import argparse
from orb import Orb
import os
import sys
import uuid
from datetime import datetime, timedelta

# Set up argument parser
parser = argparse.ArgumentParser(description='Run backfill for Orb events')
parser.add_argument('--external-customer-id', type=str, default="acme", help='External customer ID')
parser.add_argument('--batch-size', type=int, default=400, help='Batch size for processing')
parser.add_argument('--start-date', type=str, help='Start date in ISO format (YYYY-MM-DD)')
parser.add_argument('--end-date', type=str, help='End date in ISO format (YYYY-MM-DD)')
parser.add_argument('--event-name', type=str, help='Event name')
parser.add_argument('--num-events', type=int, default=10, help='Number of events per day')
parser.add_argument('--event-properties', type=str, default="{}", help='JSON string of additional event properties')
parser.add_argument('--config-file', type=str, help='Path to JSON configuration file')
parser.add_argument('--job-id', type=str, help='Job ID for tracking')
parser.add_argument('--replace-existing-events', action='store_true', default=True, help='Replace existing events in timeframe')

args = parser.parse_args()

BATCH_SIZE = args.batch_size
MAX_DAYS_PER_CHUNK = 10  # Maximum days per chunk
FIXED_TIME = "12:00:00"  # Use noon for all events

# Initialize EVENT_PROPERTIES to ensure it's defined
EVENT_PROPERTIES = {}

# If a config file is provided, load configuration from it
if args.config_file:
    try:
        print(f"Loading configuration from: {args.config_file}")
        with open(args.config_file, 'r') as f:
            file_config = json.load(f)
            
        if 'config' in file_config:
            config = file_config['config']
            JOB_ID = file_config.get('jobId') or config.get('jobId')
        else:
            config = file_config
            JOB_ID = config.get('jobId')
            
        EVENT_NAME = config.get('event_name')
        EXTERNAL_CUSTOMER_ID = config.get('external_customer_id')
        BACKFILL_CUSTOMER_ID = config.get('backfill_customer_id')
        REPLACE_EXISTING_EVENTS = config.get('replace_existing_events')
        
        if BACKFILL_CUSTOMER_ID:
            EXTERNAL_CUSTOMER_ID = BACKFILL_CUSTOMER_ID
        elif not EXTERNAL_CUSTOMER_ID:
            EXTERNAL_CUSTOMER_ID = 'acme'
            
        start_date_str = config.get('start_date', '').split('T')[0]
        end_date_str = config.get('end_date', '').split('T')[0]
        
        events_per_day_config = config.get('events_per_day', 10)
        if isinstance(events_per_day_config, dict):
            min_events = int(events_per_day_config.get('min', 1))
            max_events = int(events_per_day_config.get('max', 10))
        elif isinstance(events_per_day_config, (int, str)):
            num = int(events_per_day_config)
            min_events = max(1, num - 2)
            max_events = num + 2
        else:
            min_events = 1
            max_events = 10
        NUM_EVENTS_RANGE = (min_events, max_events)

        EVENT_PROPERTIES = config.get('properties', {})
        
    except Exception as e:
        print(f"Error loading config file: {e}")
        sys.exit(1)
else:
    # Use command line arguments if no config file
    EVENT_NAME = args.event_name
    EXTERNAL_CUSTOMER_ID = args.external_customer_id
    start_date_str = args.start_date.split('T')[0] if args.start_date else None
    end_date_str = args.end_date.split('T')[0] if args.end_date else None
    NUM_EVENTS_RANGE = (1, min(args.num_events, 10))
    JOB_ID = args.job_id
    REPLACE_EXISTING_EVENTS = args.replace_existing_events
    
    try:
        EVENT_PROPERTIES = json.loads(args.event_properties)
    except Exception as e:
        print(f"Error parsing event properties from command line: {e}")
        EVENT_PROPERTIES = {}

# Validate required parameters
if not EVENT_NAME:
    print("Error: event_type is required")
    sys.exit(1)
    
if not start_date_str or not end_date_str:
    print("Error: start_date and end_date are required")
    sys.exit(1)

# Parse the start and end dates
try:
    start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
    end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    
    print(f"Start date: {start_date}")
    print(f"End date: {end_date}")
    
    # Calculate how many days are in the range (inclusive)
    days_in_range = (end_date - start_date).days + 1
    print(f"Days in range: {days_in_range}")
    
except Exception as e:
    print(f"Error parsing dates: {e}")
    sys.exit(1)

# Initialize Orb client
try:
    # Try to get the API key from both possible environment variables
    orb_api_key = os.environ.get("ORB_API_KEY") or os.environ.get("ORB_API_TOKEN")
    
    if not orb_api_key:
        print("Error: Neither ORB_API_KEY nor ORB_API_TOKEN environment variable is set")
        sys.exit(1)
        
    client = Orb(
        api_key=orb_api_key,
    )
    print("Successfully initialized Orb client")
except Exception as e:
    print(f"Error initializing Orb client: {e}")
    sys.exit(1)

# Define helper functions
def batch(iterable, n=1):
    """Create batches from an iterable"""
    length = len(iterable)
    for ndx in range(0, length, n):
        yield iterable[ndx: min(ndx + n, length)]


def generate_string_id():
    """Generate a unique string ID using standard uuid"""
    return str(uuid.uuid4())[:16]


def generate_idempotency_key():
    """Generate a unique idempotency key for events"""
    prefix = JOB_ID if JOB_ID else "ORB_GENERATED"
    return f"{prefix}_{generate_string_id()}"


def generate_timestamp(dt):
    """Generate timestamp with fixed time (noon)"""
    return f"{dt.year}-{dt.month:02}-{dt.day:02}T{FIXED_TIME}Z"


def get_date_chunks(start_date, end_date, max_days=MAX_DAYS_PER_CHUNK):
    """Split a date range into chunks of max_days or less"""
    chunks = []
    current_date = start_date
    
    while current_date <= end_date:
        # Calculate the end of this chunk (either max_days away or the end_date, whichever is sooner)
        chunk_end = min(current_date + timedelta(days=max_days-1), end_date)
        chunks.append((current_date, chunk_end))
        
        # Move to the start of the next chunk
        current_date = chunk_end + timedelta(days=1)
    
    return chunks


def generate_property_value(prop_config):
    """Generate a value for a property based on its configuration."""
    if not isinstance(prop_config, dict):
        return prop_config

    if prop_config.get('useUUID') is True:
        return str(uuid.uuid4())

    prop_type = prop_config.get('type')
    if prop_type == 'set' and 'values' in prop_config:
        values_list = prop_config['values']
        if isinstance(values_list, list) and values_list:
            return random.choice(values_list)
        else:
            return "" 
    elif prop_type == 'range' and 'min' in prop_config and 'max' in prop_config:
        try:
            min_val = int(prop_config['min'])
            max_val = int(prop_config['max'])
            if min_val > max_val:
                return min_val
            return random.randint(min_val, max_val)
        except (ValueError, TypeError):
            return random.randint(1, 10)

    if 'value' in prop_config:
        return prop_config['value']
    
    return str(prop_config)


def generate_events_for_date_range(start_date, end_date):
    """Generate events for each day in the date range with random event counts"""
    events = []
    min_events, max_events = NUM_EVENTS_RANGE
    
    current_date = start_date
    total_days = (end_date - start_date).days + 1
    total_events_generated = 0

    while current_date <= end_date:
        daily_events = random.randint(min_events, max_events)
        total_events_generated += daily_events
        
        for _ in range(daily_events):
            properties = {}
            for key, config_value in EVENT_PROPERTIES.items():
                properties[key] = generate_property_value(config_value)
            
            events.append({
                "external_customer_id": EXTERNAL_CUSTOMER_ID,
                "event_name": EVENT_NAME,
                "timestamp": generate_timestamp(current_date),
                "idempotency_key": generate_idempotency_key(),
                "properties": properties,
            })
        
        current_date += timedelta(days=1)
    
    print(f"Generated {total_events_generated} events over {total_days} days")
    print(f"Average events per day: {total_events_generated / total_days:.2f}")
    
    return events


def check_and_revert_pending_backfills():
    """Check for any pending backfills and revert them"""
    print("Checking for pending backfills...")
    backfills = client.events.backfills.list()
    pending_backfills = [backfill for backfill in backfills if backfill.status in ["pending", "pending_revert"]]
    
    if pending_backfills:
        print(f"Found {len(pending_backfills)} pending backfills. Reverting them before proceeding.")
        
        for backfill in pending_backfills:
            try:
                if backfill.status == "pending":
                    client.events.backfills.revert(backfill.id)
                    print(f"Reverted backfill {backfill.id}")
            except Exception as e:
                print(f"Error reverting backfill {backfill.id}: {e}")
        
        # Wait for all backfills to be reverted
        print("Waiting for backfills to be reverted...")
        while True:
            backfills = client.events.backfills.list()
            if all([backfill.status not in ["pending", "pending_revert"] for backfill in backfills]):
                break
            time.sleep(5)
            print(".", end="", flush=True)
        print("\nAll pending backfills have been reverted.")
    else:
        print("No pending backfills found.")


def ingest_batch(events, chunk_start_date, chunk_end_date, chunk_number, total_chunks):
    """Ingest a batch of events within the specified timeframe"""
    if not events:
        print("No events to ingest for this timeframe")
        return True
    
    # Add one day to the end date to make it inclusive in the timeframe
    next_day = chunk_end_date + timedelta(days=1)
        
    try:
        # Format dates for the API - trying ISO format without the milliseconds
        # which should give: YYYY-MM-DDTHH:MM:SS
        timeframe_start = datetime(chunk_start_date.year, chunk_start_date.month, 
                                  chunk_start_date.day, 0, 0, 0)
        timeframe_end = datetime(next_day.year, next_day.month, next_day.day, 0, 0, 0)
        
        timeframe_start_str = timeframe_start.isoformat()
        timeframe_end_str = timeframe_end.isoformat()
        
        print(f"Creating backfill for timeframe: {timeframe_start_str} to {timeframe_end_str}")
        
        backfill = client.events.backfills.create(
            timeframe_start=timeframe_start_str,
            timeframe_end=timeframe_end_str,
            external_customer_id=EXTERNAL_CUSTOMER_ID,
            replace_existing_events=REPLACE_EXISTING_EVENTS,
        )

        print(f"Opened backfill {backfill.id}")
        print(f"Processing {len(events)} events")

        num_batches_processed = 1
        total_batch_chunks = (len(events) + BATCH_SIZE - 1) // BATCH_SIZE  # Ceiling division
        
        for curr_batch in batch(events, BATCH_SIZE):
            print(f"Processing batch chunk {num_batches_processed}/{total_batch_chunks} ({len(curr_batch)} events)... ", end="", flush=True)
            
            try:
                result = client.events.ingest(
                    events=curr_batch,
                    backfill_id=backfill.id
                )
                
                if len(result.validation_failed) > 0:
                    print("FAILED")
                    print(f"Batch failed to process: {result.validation_failed}")
                    client.events.backfills.close(backfill.id, status="failed")
                    return False
                else:
                    print("SUCCESS")
                    
                num_batches_processed += 1
                
            except Exception as e:
                print("ERROR")
                print(f"Error ingesting batch: {e}")
                try:
                    client.events.backfills.close(backfill.id, status="failed")
                except:
                    pass
                return False

        print("All batches processed, closing backfill...")
        client.events.backfills.close(backfill.id)

        # Wait until backfill is reflected
        print("Waiting for backfill to be reflected...")
        max_attempts = 60  # Prevent infinite loop # Now 10 minutes (60 * 10s)
        attempts = 0
        last_logged_status = None
        
        while attempts < max_attempts:
            try:
                status = client.events.backfills.fetch(backfill.id).status
                
                # Only log status when it changes
                if status != last_logged_status:
                    print(f"Backfill status: {status}")
                    last_logged_status = status
                
                if status == "reflected":
                    break
                elif status in ["failed", "reverted"]:
                    print(f"Backfill failed with status: {status}")
                    return False
                    
                attempts += 1
                time.sleep(10)  # Changed from 5 to 10
                
            except Exception as e:
                print(f"Error checking backfill status: {e}")
                attempts += 1
                time.sleep(10)  # Changed from 5 to 10
                
        if attempts >= max_attempts:
            print("Timed out waiting for backfill to be reflected")
            return False

        print("Events in batch successfully ingested")
        return True
        
    except Exception as e:
        print(f"Error creating backfill: {e}")
        return False


# Main execution
if __name__ == "__main__":
    print(f"\n{'='*80}")
    print(f"STARTING BACKFILL JOB: {JOB_ID}")
    print(f"{'='*80}\n")
    
    print(f"Event Name: {EVENT_NAME}")
    print(f"Customer ID: {EXTERNAL_CUSTOMER_ID}")
    print(f"Date Range: {start_date} to {end_date}")
    print(f"Events Per Day: Random between {NUM_EVENTS_RANGE[0]} and {NUM_EVENTS_RANGE[1]}")
    print(f"Fixed Time: {FIXED_TIME}")
    
    # Print property configurations
    if EVENT_PROPERTIES:
        print("\nProperty Configurations:")
        for prop_name, prop_config in EVENT_PROPERTIES.items():
            if isinstance(prop_config, dict) and prop_config.get('type') == 'set':
                print(f"  - {prop_name}: Random choice from {len(prop_config['values'])} values")
            elif isinstance(prop_config, dict) and prop_config.get('type') == 'range':
                print(f"  - {prop_name}: Random integer between {prop_config['min']} and {prop_config['max']}")
            else:
                print(f"  - {prop_name}: Static value")
    
    # Check for any pending backfills and revert them
    check_and_revert_pending_backfills()
    
    # Split the date range into chunks
    date_chunks = get_date_chunks(start_date, end_date)
    total_chunks = len(date_chunks)
    print(f"\nProcessing {total_chunks} date chunks (max {MAX_DAYS_PER_CHUNK} days per chunk)")
    
    # Calculate estimated total events (using average of min and max)
    min_events, max_events = NUM_EVENTS_RANGE
    avg_events_per_day = (min_events + max_events) / 2
    estimated_total_events = days_in_range * avg_events_per_day
    print(f"Estimated total events: {estimated_total_events:.0f} ({days_in_range} days × {avg_events_per_day:.1f} avg events/day)")
    print(f"Minimum possible events: {days_in_range * min_events}")
    print(f"Maximum possible events: {days_in_range * max_events}")
    
    success = True
    events_processed = 0
    
    # Process each chunk
    start_time = time.time()
    for i, (chunk_start, chunk_end) in enumerate(date_chunks):
        chunk_number = i + 1
        chunk_start_time = time.time()
        
        print(f"\n{'-'*80}")
        print(f"Processing chunk {chunk_number}/{total_chunks}: {chunk_start} to {chunk_end}")
        print(f"{'-'*80}")
        
        # Generate events for this chunk
        print(f"Generating events for chunk {chunk_number}...", end="", flush=True)
        events = generate_events_for_date_range(chunk_start, chunk_end)
        print(f" Done. Generated {len(events)} events.")
        
        # Sample of generated events for verification
        if events:
            print("\nSample event:")
            sample_event = events[0]
            print(f"  - Timestamp: {sample_event['timestamp']}")
            print(f"  - Customer ID: {sample_event['external_customer_id']}")
            print(f"  - Event Name: {sample_event['event_name']}")
            print(f"  - Idempotency Key: {sample_event['idempotency_key']}")
            
            print("  - Properties:")
            for key, value in sample_event['properties'].items():
                print(f"    * {key}: {value}")
        
        # Ingest the events
        chunk_success = ingest_batch(events, chunk_start, chunk_end, chunk_number, total_chunks)
        
        if not chunk_success:
            print(f"\nFAILED to process chunk {chunk_number}")
            success = False
            break
        
        events_processed += len(events)
        chunk_end_time = time.time()
        chunk_duration = chunk_end_time - chunk_start_time
        
        print(f"\nSuccessfully processed chunk {chunk_number}/{total_chunks}")
        print(f"Chunk duration: {chunk_duration:.2f} seconds")
        
        # Show progress
        progress_pct = (chunk_number / total_chunks) * 100
        events_pct = (events_processed / estimated_total_events) * 100 if estimated_total_events > 0 else 0
        elapsed = time.time() - start_time
        estimated_total = elapsed / progress_pct * 100 if progress_pct > 0 else 0
        remaining = max(0, estimated_total - elapsed)
        
        print(f"Progress: {progress_pct:.1f}% of chunks, {events_pct:.1f}% of events")
        print(f"Time elapsed: {elapsed:.1f}s, Estimated remaining: {remaining:.1f}s")
    
    end_time = time.time()
    total_duration = end_time - start_time
    
    if success:
        print(f"\n{'='*80}")
        print(f"BACKFILL JOB COMPLETED SUCCESSFULLY: {JOB_ID}")
        print(f"Total events processed: {events_processed}")
        print(f"Total time: {total_duration:.2f} seconds")
        print(f"{'='*80}")
    else:
        print(f"\n{'='*80}")
        print(f"BACKFILL JOB FAILED: {JOB_ID}")
        print(f"Processed {events_processed} events before failure")
        print(f"Total time: {total_duration:.2f} seconds")
        print(f"{'='*80}")
        sys.exit(1)