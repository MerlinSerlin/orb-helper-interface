// Define a specific type for the backfill configuration that gets sent to the API
export type BackfillConfig = {
  event_name: string;
  external_customer_id: string;
  start_date: string;
  end_date: string;
  events_per_day: number;
  properties: Record<string, BackfillPropertyValue>;
  backfill_customer_id: string | null;
  test_mode: boolean;
  replace_existing_events: boolean;
};

// Create a specific type for the property values that can be passed to the Python script
export type BackfillPropertyValue = string | {
  type: 'set';
  values: string[];
} | {
  type: 'range';
  min: number;
  max: number;
};

// Lines below would be for backfill updates feature in webapp. Currently we don't have this feature, logging in terminal is fine for now.

export type BackfillStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type BackfillJob = {
  id: string;
  name: string;
  description?: string;
  fileUrl?: string;
  fileName?: string;
  status: BackfillStatus;
  startDate?: string;
  endDate?: string;
  eventType?: string;
  createdAt: string;
  updatedAt: string;
  progress?: number;
  error?: string;
  totalEvents?: number;
  processedEvents?: number;
};

export type BackfillFormData = {
  name: string;
  description?: string;
  eventType: string;
  startDate: string;
  endDate: string;
  file?: File;
};