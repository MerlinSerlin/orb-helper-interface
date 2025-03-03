import shortuuid
import random
import time
import json
import argparse
from orb import Orb
import os
import sys
from datetime import datetime, timedelta, date

# Set up argument parser
parser = argparse.ArgumentParser(description='Run backfill for Orb events')
parser.add_argument('--external-customer-id', type=str, default="hover_demo_customer", help='External customer ID')
parser.add_argument('--org-name', type=str, default="orb_generated", help='Organization name')
parser.add_argument('--batch-size', type=int, default=400, help='Batch size for processing')
parser.add_argument('--start-date', type=str, help='Start date in ISO format')
parser.add_argument('--end-date', type=str, help='End date in ISO format')
parser.add_argument('--event-type', type=str, help='Event type')
parser.add_argument('--num-events', type=int, default=100, help='Number of events per day')
parser.add_argument('--event-properties', type=str, default="{}", help='JSON string of additional event properties')
parser.add_argument('--config-file', type=str, help='Path to JSON configuration file')
parser.add_argument('--job-id', type=str, help='Job ID for tracking')

args = parser.parse_args()

BATCH_SIZE = args.batch_size
MAX_DAYS_PER_CHUNK = 10  # Maximum days per chunk

# If a config file is provided, load configuration from it
if args.config_file:
    try:
        print(f"Loading configuration from: {args.config_file}")
        with open(args.config_file, 'r') as f:
            file_config = json.load(f)
            
        # For debugging: print the raw configuration structure
        print(f"Raw config structure: {json.dumps(file_config, indent=2)}")
            
        # The config structure may vary - handle both direct and nested formats
        if 'config' in file_config:
            config = file_config['config']
            # If jobId is at the root level, grab it
            JOB_ID = file_config.get('jobId') or config.get('jobId')
        else:
            config = file_config
            JOB_ID = config.get('jobId')
            
        # Extract values from config
        EVENT_TYPE = config.get('event_name')
        EXTERNAL_CUSTOMER_ID = config.get('external_customer_id')
        BACKFILL_CUSTOMER_ID = config.get('backfill_customer_id')
        
        # Use backfill_customer_id if provided, otherwise fall back to external_customer_id
        if BACKFILL_CUSTOMER_ID:
            EXTERNAL_CUSTOMER_ID = BACKFILL_CUSTOMER_ID
        elif not EXTERNAL_CUSTOMER_ID:
            EXTERNAL_CUSTOMER_ID = 'hover_demo_customer'  # Default value
            
        START_DATE = config.get('start_date')
        END_DATE = config.get('end_date')
        NUM_EVENTS = config.get('events_per_day', 100)
        EVENT_PROPERTIES = config.get('properties', {})
        
        print(f"Parsed configuration: event={EVENT_TYPE}, customer={EXTERNAL_CUSTOMER_ID}, jobId={JOB_ID}")
        
    except Exception as e:
        print(f"Error loading config file: {e}")
        sys.exit(1)
else:
    # Use command line arguments if no config file
    EVENT_TYPE = args.event_type
    EXTERNAL_CUSTOMER_ID = args.external_customer_id
    START_DATE = args.start_date
    END_DATE = args.end_date
    NUM_EVENTS = args.num_events
    JOB_ID = args.job_id
    
    # Parse event properties from command line
    try:
        EVENT_PROPERTIES = json.loads(args.event_properties)
    except Exception as e:
        print(f"Error parsing event properties: {e}")
        EVENT_PROPERTIES = {}

# Validate required parameters
if not EVENT_TYPE:
    print("Error: event_type is required")
    sys.exit(1)
    
if not START_DATE or not END_DATE:
    print("Error: start_date and end_date are required")
    sys.exit(1)

# Parse start and end dates
try:
    # Remove microseconds if present
    start_date = START_DATE.split('.')[0]
    end_date = END_DATE.split('.')[0]
    
    # Convert to datetime objects for easier manipulation
    start_datetime = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
    end_datetime = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
    
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

def batch(iterable, n=1):
    """
    Create batches
    From: https://stackoverflow.com/questions/8290397/how-to-split-an-iterable-in-constant-size-chunks
    """
    length = len(iterable)
    for ndx in range(0, length, n):
        yield iterable[ndx: min(ndx + n, length)]


def generate_idempotency_key():
    """
    Generate a unique idempotency key using the job ID as a prefix
    This helps track which events came from which backfill job
    """
    prefix = JOB_ID if JOB_ID else "ORB_GENERATED"
    return f"{prefix}_{generate_string_id()}"


def generate_string_id():
    return shortuuid.uuid()[:16]


def generate_timestamp(dt):
    """Generate timestamp from datetime object"""
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def get_date_chunks(start_date, end_date, max_days=MAX_DAYS_PER_CHUNK):
    """
    Split a date range into chunks of max_days or less
    Returns list of (chunk_start_date, chunk_end_date) tuples
    """
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
    """
    Generate a value for a property based on its configuration
    Supports:
    - Simple values (strings, numbers, booleans)
    - Sets of values to choose from randomly (type: "set", values: [...])
    - Numeric ranges to generate random integers (type: "range", min: X, max: Y)
    """
    # If the property is a simple string/value, return it as is
    if not isinstance(prop_config, dict):
        return prop_config
        
    # Handle randomized properties
    if prop_config.get('type') == 'set' and 'values' in prop_config:
        # Random choice from a set of values
        return random.choice(prop_config['values'])
    elif prop_config.get('type') == 'range' and 'min' in prop_config and 'max' in prop_config:
        # Random integer in a range
        try:
            min_val = int(prop_config['min'])
            max_val = int(prop_config['max'])
            return random.randint(min_val, max_val)
        except (ValueError, TypeError):
            print(f"Warning: Invalid range values: {prop_config}. Using default range 1-100.")
            return random.randint(1, 100)
    
    # Default fallback
    return str(prop_config)


def generate_event_shape(timestamp):
    """
    Generate an event using the configured properties from the UI
    
    This function creates the basic shape of an event with:
    - Dynamic external customer ID from UI input
    - Dynamic event name from UI input
    - Randomized properties based on UI configuration
    - Unique idempotency key
    - Timestamp
    """
    # Start with an empty properties dictionary
    properties = {}
    
    # Process each configured property
    for key, config in EVENT_PROPERTIES.items():
        properties[key] = generate_property_value(config)
    
    return {
        "external_customer_id": EXTERNAL_CUSTOMER_ID,
        "event_name": EVENT_TYPE,
        "timestamp": generate_timestamp(timestamp),
        "idempotency_key": generate_idempotency_key(),
        "properties": properties,
    }


def ingest_batch(events, timeframe_start, timeframe_end):
    """
    Ingest a batch of events within the specified timeframe
    
    Creates a backfill, processes events in batches, and waits for the
    backfill to be reflected before returning.
    
    Returns True if successful, False otherwise.
    """
    if not events:
        print("No events to ingest for this timeframe")
        return True
    
    # Add one second to the end time to ensure inclusive range
    adjusted_end = timeframe_end + timedelta(seconds=1)
        
    try:
        timeframe_start_str = timeframe_start.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        timeframe_end_str = adjusted_end.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        
        print(f"Creating backfill for timeframe: {timeframe_start_str} to {timeframe_end_str}")
        
        backfill = client.events.backfills.create(
            timeframe_start=timeframe_start_str,
            timeframe_end=timeframe_end_str,
            external_customer_id=EXTERNAL_CUSTOMER_ID,
            replace_existing_events=True,
        )

        print(f"Opened backfill {backfill.id}")
        print(f"Processing {len(events)} events")

        num_batches_processed = 1
        total_batches = (len(events) + BATCH_SIZE - 1) // BATCH_SIZE  # Ceiling division
        
        for curr_batch in batch(events, BATCH_SIZE):
            print(f"Processing batch {num_batches_processed}/{total_batches} ({len(curr_batch)} events)")
            
            try:
                result = client.events.ingest(
                    events=curr_batch,
                    backfill_id=backfill.id
                )
                
                if len(result.validation_failed) > 0:
                    print(f"Batch failed to process: {result.validation_failed}")
                    client.events.backfills.close(backfill.id, status="failed")
                    return False
                else:
                    print(f"Batch {num_batches_processed}/{total_batches} processed successfully")
                    
                num_batches_processed += 1
                time.sleep(5)  # Reduced sleep time
                
            except Exception as e:
                print(f"Error ingesting batch: {e}")
                try:
                    client.events.backfills.close(backfill.id, status="failed")
                except:
                    pass
                return False

        print("All batches processed, closing backfill")
        client.events.backfills.close(backfill.id)

        # wait until backfill is reflected
        max_attempts = 30  # Prevent infinite loop
        attempts = 0
        
        while attempts < max_attempts:
            try:
                status = client.events.backfills.fetch(backfill.id).status
                print(f"Current status: {status}")
                
                if status == "reflected":
                    break
                elif status in ["failed", "reverted"]:
                    print(f"Backfill failed with status: {status}")
                    return False
                    
                attempts += 1
                time.sleep(5)
                
            except Exception as e:
                print(f"Error checking backfill status: {e}")
                attempts += 1
                time.sleep(5)
                
        if attempts >= max_attempts:
            print("Timed out waiting for backfill to be reflected")
            return False

        print("Events in batch successfully ingested")
        return True
        
    except Exception as e:
        print(f"Error creating backfill: {e}")
        return False


def generate_events_for_date_range(start_date, end_date, num_events=NUM_EVENTS):
    """
    Generate events for each day in the date range
    
    For each day in the range:
    1. Generates exactly num_events for that day
    2. Distributes events evenly throughout the day to avoid timestamp collisions
    3. Ensures all events fall within the specified timeframe
    """
    events = []
    
    # Handle the case where start and end are on the same day
    if start_date.date() == end_date.date():
        # Calculate how many events to generate for the partial day
        day_events = num_events
        
        # Calculate the available time range for this day (in seconds)
        start_time_seconds = start_date.hour * 3600 + start_date.minute * 60 + start_date.second
        end_time_seconds = end_date.hour * 3600 + end_date.minute * 60 + end_date.second
        available_seconds = end_time_seconds - start_time_seconds
        
        # Distribute events evenly across the available time
        for i in range(day_events):
            # Determine the timestamp for this event
            if day_events == 1:
                # If only one event, place it at the midpoint
                offset_seconds = available_seconds // 2
            else:
                # Otherwise distribute events evenly
                offset_seconds = int(available_seconds * i / (day_events - 1)) if day_events > 1 else 0
            
            event_time_seconds = start_time_seconds + offset_seconds
            hours = event_time_seconds // 3600
            minutes = (event_time_seconds % 3600) // 60
            seconds = event_time_seconds % 60
            
            # Create the datetime with the precise time
            event_time = datetime(
                start_date.year,
                start_date.month,
                start_date.day,
                hours, minutes, seconds,
                tzinfo=start_date.tzinfo
            )
            
            events.append(generate_event_shape(event_time))
        
        return events
    
    # For multi-day ranges, process each day
    current_date = start_date
    while current_date.date() <= end_date.date():
        # Determine if this is the first day, last day, or a middle day
        is_first_day = current_date.date() == start_date.date()
        is_last_day = current_date.date() == end_date.date()
        
        # For the first day, only use the hours from start_date time to end of day
        if is_first_day:
            # Calculate the available hours in the first day
            start_hour = current_date.hour
            available_hours = 24 - start_hour
            # Scale the number of events based on the available portion of the day
            day_events = max(1, int(num_events * available_hours / 24))
            
            # Create events distributed from start_time to midnight
            for i in range(day_events):
                # Calculate seconds available from start time to midnight
                start_seconds = current_date.hour * 3600 + current_date.minute * 60 + current_date.second
                end_of_day_seconds = 24 * 3600
                available_seconds = end_of_day_seconds - start_seconds
                
                if day_events == 1:
                    # If only one event, place it at the midpoint
                    offset_seconds = available_seconds // 2
                else:
                    # Otherwise distribute events evenly
                    offset_seconds = int(available_seconds * i / (day_events - 1)) if day_events > 1 else 0
                
                event_time_seconds = start_seconds + offset_seconds
                hours = event_time_seconds // 3600
                minutes = (event_time_seconds % 3600) // 60
                seconds = event_time_seconds % 60
                
                event_time = datetime(
                    current_date.year,
                    current_date.month,
                    current_date.day,
                    min(23, hours), minutes, seconds,
                    tzinfo=current_date.tzinfo
                )
                
                events.append(generate_event_shape(event_time))
                
        # For the last day, only use the hours from start of day to end_date time
        elif is_last_day:
            # Calculate the available hours in the last day
            end_hour = end_date.hour
            available_hours = end_hour + 1  # Include the end hour
            # Scale the number of events based on the available portion of the day
            day_events = max(1, int(num_events * available_hours / 24))
            
            # Create events distributed from midnight to end_time
            for i in range(day_events):
                start_of_day_seconds = 0
                end_seconds = end_date.hour * 3600 + end_date.minute * 60 + end_date.second
                available_seconds = end_seconds - start_of_day_seconds
                
                if day_events == 1:
                    # If only one event, place it at the midpoint
                    offset_seconds = available_seconds // 2
                else:
                    # Otherwise distribute events evenly
                    offset_seconds = int(available_seconds * i / (day_events - 1)) if day_events > 1 else 0
                
                event_time_seconds = start_of_day_seconds + offset_seconds
                hours = event_time_seconds // 3600
                minutes = (event_time_seconds % 3600) // 60
                seconds = event_time_seconds % 60
                
                event_time = datetime(
                    current_date.year,
                    current_date.month,
                    current_date.day,
                    hours, minutes, seconds,
                    tzinfo=current_date.tzinfo
                )
                
                events.append(generate_event_shape(event_time))
                
        # For middle days, distribute events throughout the entire day
        else:
            # Use the full number of events for complete days
            day_events = num_events
            
            # Create events distributed throughout the day
            for i in range(day_events):
                # Calculate a time point in the day (in seconds)
                if day_events == 1:
                    # If only one event, place it at noon
                    time_seconds = 12 * 3600
                else:
                    # Otherwise distribute events evenly from midnight to 11:59 PM
                    total_seconds = 24 * 3600 - 1  # 24 hours - 1 second
                    time_seconds = int(total_seconds * i / (day_events - 1)) if day_events > 1 else 0
                
                hours = time_seconds // 3600
                minutes = (time_seconds % 3600) // 60
                seconds = time_seconds % 60
                
                event_time = datetime(
                    current_date.year,
                    current_date.month,
                    current_date.day,
                    hours, minutes, seconds,
                    tzinfo=current_date.tzinfo
                )
                
                events.append(generate_event_shape(event_time))
        
        # Move to the next day
        next_day = current_date.date() + timedelta(days=1)
        current_date = datetime.combine(next_day, datetime.min.time(), tzinfo=current_date.tzinfo)
    
    return events


def check_and_revert_pending_backfills():
    """
    Check for any pending backfills and revert them
    """
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
        while True:
            backfills = client.events.backfills.list()
            if all([backfill.status not in ["pending", "pending_revert"] for backfill in backfills]):
                break
            time.sleep(5)


if __name__ == "__main__":
    print(f"\n{'='*80}")
    print(f"STARTING BACKFILL JOB: {JOB_ID}")
    print(f"{'='*80}\n")
    
    print(f"Event Type: {EVENT_TYPE}")
    print(f"Customer ID: {EXTERNAL_CUSTOMER_ID}")
    print(f"Date Range: {start_datetime.isoformat()} to {end_datetime.isoformat()}")
    print(f"Events Per Day: {NUM_EVENTS}")
    
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
    date_chunks = get_date_chunks(start_datetime, end_datetime)
    print(f"\nProcessing {len(date_chunks)} date chunks (max {MAX_DAYS_PER_CHUNK} days per chunk)")
    
    success = True
    
    # Process each chunk
    for i, (chunk_start, chunk_end) in enumerate(date_chunks):
        print(f"\n{'-'*50}")
        print(f"Processing chunk {i+1}/{len(date_chunks)}: {chunk_start.isoformat()} to {chunk_end.isoformat()}")
        print(f"{'-'*50}")
        
        # Generate events for this chunk
        events = generate_events_for_date_range(chunk_start, chunk_end)
        print(f"Generated {len(events)} events for this chunk")
        
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
        chunk_success = ingest_batch(events, chunk_start, chunk_end)
        
        if not chunk_success:
            print(f"\nFAILED to process chunk {i+1}")
            success = False
            break
        
        print(f"\nSuccessfully processed chunk {i+1}/{len(date_chunks)}")
    
    if success:
        print(f"\n{'='*80}")
        print(f"BACKFILL JOB COMPLETED SUCCESSFULLY: {JOB_ID}")
        print(f"{'='*80}")
    else:
        print(f"\n{'='*80}")
        print(f"BACKFILL JOB FAILED: {JOB_ID}")
        print(f"{'='*80}")
        sys.exit(1)