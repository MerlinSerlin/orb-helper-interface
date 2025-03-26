'use client'

import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { type Event, type Property, type LookalikeRange } from '@/types/events'
import { convertToLocalTimeISO } from '@/lib/utils'

interface EventState {
  events: Event[]
  generatedEventCount: number
  isSubmitting: boolean
  error: string | null
}

interface EventActions {
  // Event actions
  addEvent: () => void
  updateEvent: (index: number, field: keyof Omit<Event, "properties">, value: string | boolean) => void
  removeEvent: (index: number) => void
  
  // Property actions
  addProperty: (eventIndex: number) => void
  updateProperty: (
    eventIndex: number,
    propertyIndex: number,
    field: keyof Property,
    value: string | boolean | string[] | LookalikeRange | undefined
  ) => void
  removeProperty: (eventIndex: number, propertyIndex: number) => void
  
  // Lookalike events
  setGeneratedEventCount: (count: number) => void
  
  // Form state
  setIsSubmitting: (isSubmitting: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
  markEventsAsSubmitted: () => void
  regenerateIdempotencyKeys: () => void
}

type EventStore = EventState & EventActions

const createInitialEvent = (): Event => ({
  event_name: "",
  timestamp: convertToLocalTimeISO(new Date()),
  properties: [],
  idempotency_key: uuidv4(),
  external_customer_id: "",
  submitted: false,
})

export const useEventStore = create<EventStore>((set) => ({
  // Initial state
  events: [createInitialEvent()],
  generatedEventCount: 0,
  isSubmitting: false,
  error: null,
  

  // Event actions
  addEvent: () => set((state) => ({
    events: [...state.events, createInitialEvent()]
  })),

  updateEvent: (index: number, field: keyof Event, value: any) => 
    set((state) => ({
      events: state.events.map((event, i) => 
        i === index ? { ...event, [field]: value } : event
      )
    })),

  removeEvent: (index) => set((state) => ({
    events: state.events.filter((_, i) => i !== index)
  })),

  // Property actions
  addProperty: (eventIndex) => set((state) => ({
    events: state.events.map((event, i) => {
      if (i === eventIndex) {
        return {
          ...event,
          properties: [
            ...event.properties,
            {
              key: "",
              value: "",
              isLookalike: false,
              lookalikeType: undefined,
              lookalikeValues: undefined,
              lookalikeRange: undefined
            }
          ]
        }
      }
      return event
    })
  })),

  updateProperty: (eventIndex, propertyIndex, field, value) => set((state) => ({
    events: state.events.map((event, i) => {
      if (i === eventIndex) {
        const updatedProperties = event.properties.map((prop, j) => {
          if (j === propertyIndex) {
            const updatedProp = { ...prop, [field]: value }

            // Handle lookalike type changes
            if (field === "lookalikeType") {
              if (value === "set") {
                updatedProp.lookalikeRange = undefined
                updatedProp.lookalikeValues = []
              } else if (value === "range") {
                updatedProp.lookalikeValues = undefined
                updatedProp.lookalikeRange = { min: 0, max: 0 }
              }
            }

            // Clear lookalike values when isLookalike is set to false
            if (field === "isLookalike" && !value) {
              updatedProp.lookalikeType = undefined
              updatedProp.lookalikeValues = undefined
              updatedProp.lookalikeRange = undefined
            }

            return updatedProp
          }
          return prop
        })
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

  // Lookalike events
  setGeneratedEventCount: (count) => set({
    generatedEventCount: count
  }),

  // Form state
  setIsSubmitting: (isSubmitting) => set({
    isSubmitting
  }),

  setError: (error) => set({
    error
  }),

  reset: () => set({
    events: [createInitialEvent()],
    generatedEventCount: 0,
    isSubmitting: false,
    error: null
  }),

  markEventsAsSubmitted: () => 
    set(state => ({
      events: state.events.map(event => ({ 
        ...event, 
        animatingSubmission: true,
        lastSubmittedAt: new Date().toISOString()
      }))
    })),

  regenerateIdempotencyKeys: () => set((state) => ({
    events: state.events.map(event => ({
      ...event,
      idempotency_key: uuidv4(), // Generate a new UUID
    }))
  })),
}))

// Selectors for performance optimization
export const selectEvents = (state: EventStore) => state.events
export const selectGeneratedEventCount = (state: EventStore) => state.generatedEventCount
export const selectIsSubmitting = (state: EventStore) => state.isSubmitting
export const selectError = (state: EventStore) => state.error