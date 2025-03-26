// app/_components/EventForm/useEventSubmission.ts
'use client'

import { useMutation } from '@tanstack/react-query'
import { submitEvents } from '@/app/actions/events'
import { useEventStore } from './store'
import { generateLookalikeEvents } from '@/lib/utils'

export const useEventSubmission = (preserveFormData: boolean) => {
  const { events, generatedEventCount, reset, regenerateIdempotencyKeys, markEventsAsSubmitted } = useEventStore()
  
  return useMutation({
    mutationFn: async () => {
      const lastEvent = events[events.length - 1]
      const allEvents = [
        ...events,
        ...generateLookalikeEvents(lastEvent, generatedEventCount)
      ]

      // Transform the events to match the server's expected format
      const formattedEvents = allEvents.map(event => ({
        ...event,
        properties: Object.fromEntries(
          event.properties.map(prop => [prop.key, prop.value])
        ),
        timestamp: new Date(event.timestamp).toISOString()
      }))

      return submitEvents(formattedEvents)
    },
    onSuccess: (data) => {
      if (data.success) {
        if (preserveFormData) {
          // Mark events as submitted first
          markEventsAsSubmitted();
          // Then regenerate idempotency keys for next submission
          regenerateIdempotencyKeys();
        } else {
          // Otherwise, reset as before
          reset();
        }
      }
    }
  })
}