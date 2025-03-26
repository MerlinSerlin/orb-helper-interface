import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { Event, Property, LookalikeRange } from '@/types/events'
import { convertToLocalTimeISO } from '@/lib/utils'

interface EventStore {
  events: Event[]
  generatedEventCount: number
  addEvent: () => void
  updateEvent: (index: number, field: keyof Omit<Event, "properties">, value: string) => void
  removeEvent: (index: number) => void
  addProperty: (eventIndex: number) => void
  updateProperty: (
    eventIndex: number,
    propertyIndex: number,
    field: keyof Property,
    value: string | boolean | string[] | LookalikeRange | undefined
  ) => void
  removeProperty: (eventIndex: number, propertyIndex: number) => void
  setGeneratedEventCount: (count: number) => void
  reset: () => void
  regenerateIdempotencyKeys: () => void
  
}

const initialEvent = (): Event => ({
  event_name: "",
  timestamp: convertToLocalTimeISO(new Date()),
  properties: [],
  idempotency_key: uuidv4(),
  external_customer_id: "",
})

export const useEventStore = create<EventStore>((set) => ({
  events: [initialEvent()],
  generatedEventCount: 0,
  
  addEvent: () => set((state) => ({
    events: [...state.events, initialEvent()]
  })),
  
  updateEvent: (index, field, value) => set((state) => ({
    events: state.events.map((event, i) =>
      i === index ? { ...event, [field]: value } : event
    )
  })),
  
  removeEvent: (index) => set((state) => ({
    events: state.events.filter((_, i) => i !== index)
  })),
  
  addProperty: (eventIndex) => set((state) => ({
    events: state.events.map((event, i) => {
      if (i === eventIndex) {
        return {
          ...event,
          properties: [...event.properties, {
            key: "",
            value: "",
            isLookalike: false
          }]
        }
      }
      return event
    })
  })),
  
  updateProperty: (eventIndex, propertyIndex, field, value) => set((state) => ({
    events: state.events.map((event, i) => {
      if (i === eventIndex) {
        const updatedProperties = event.properties.map((prop, j) =>
          j === propertyIndex ? { ...prop, [field]: value } : prop
        )
        return { ...event, properties: updatedProperties }
      }
      return event
    })
  })),
  
  removeProperty: (eventIndex, propertyIndex) => set((state) => ({
    events: state.events.map((event, i) =>
      i === eventIndex
        ? {
            ...event,
            properties: event.properties.filter((_, j) => j !== propertyIndex)
          }
        : event
    )
  })),

  updateEventField: (eventIndex: number, fieldName: 'event_name' | 'timestamp' | 'external_customer_id' | 'animatingSubmission', value: any) => 
    set((state) => ({
      events: state.events.map((event, i) => 
        i === eventIndex ? { ...event, [fieldName]: value } : event
      )
    })),

  
  setGeneratedEventCount: (count) => set({ generatedEventCount: count }),
  
  reset: () => set({ events: [initialEvent()], generatedEventCount: 0 }),

  markEventsAsSubmitted: () => 
    set(state => ({
      events: state.events.map(event => ({ 
        ...event, 
        animatingSubmission: true,
        lastSubmittedAt: new Date().toISOString(),
        lastSubmittedIdempotencyKey: event.idempotency_key
      }))
    })),
  regenerateIdempotencyKeys: () => set((state) => ({
    events: state.events.map(event => ({
      ...event,
      idempotency_key: uuidv4(),
    }))
  })),
}))