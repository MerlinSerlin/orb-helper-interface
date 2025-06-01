'use client'

import { useMutation } from '@tanstack/react-query'
import { useBackfillEventStore } from './store'
import { BackfillPropertyValue } from '@/types/backfill'

interface BackfillSubmissionParams {
  startDate: string
  endDate: string
  eventsPerDayRange: { min: number; max: number }
  externalCustomerId: string
  testMode: boolean
  replaceExistingEvents: boolean
}

export const useBackfillSubmission = (preserveFormData: boolean) => {
  const { event, reset, regenerateIdempotencyKey, markEventAsSubmitted } = useBackfillEventStore()
  
  return useMutation({
    mutationFn: async (params: BackfillSubmissionParams) => {
      const { startDate, endDate, eventsPerDayRange, externalCustomerId, testMode, replaceExistingEvents } = params

      // Format the event properties for the Python script
      const eventProperties: Record<string, BackfillPropertyValue> = {};
      
      // Process each property to properly format for the Python script
      event.properties.forEach(prop => {
        if (!prop.key) return; // Skip properties without keys
        
        if (prop.useUUID) {
          // For UUID generation, we pass the useUUID flag to the Python script
          eventProperties[prop.key] = {
            useUUID: true
          };
        } else if (prop.isLookalike) {
          if (prop.lookalikeType === 'set' && prop.lookalikeValues && prop.lookalikeValues.length > 0) {
            // For set type, we pass the array of values for random.choice()
            eventProperties[prop.key] = {
              type: 'set',
              values: prop.lookalikeValues
            };
          } else if (prop.lookalikeType === 'range' && prop.lookalikeRange) {
            // For range type, we pass min and max for random.randint()
            eventProperties[prop.key] = {
              type: 'range',
              min: prop.lookalikeRange.min,
              max: prop.lookalikeRange.max
            };
          }
        } else {
          // For fixed values, we just pass the string value
          eventProperties[prop.key] = prop.value;
        }
      });

      // Create the configuration for the Python script
      const backfillConfig = {
        event_name: event.event_name,
        external_customer_id: event.external_customer_id,
        start_date: startDate,
        end_date: endDate,
        events_per_day: { type: 'range', min: eventsPerDayRange.min, max: eventsPerDayRange.max },
        properties: eventProperties,
        backfill_customer_id: externalCustomerId || null,
        test_mode: testMode,
        replace_existing_events: replaceExistingEvents
      };

      // Send to API route
      const response = await fetch('/api/backfill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backfillConfig),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start backfill');
      }

      const result = await response.json();
      return result;
    },
    onSuccess: (data) => {
      if (data.success) {
        if (preserveFormData) {
          // Mark event as submitted first
          markEventAsSubmitted();
          // Then regenerate idempotency key for next submission
          regenerateIdempotencyKey();
        } else {
          // Otherwise, reset as before
          reset();
        }
      }
    }
  })
} 