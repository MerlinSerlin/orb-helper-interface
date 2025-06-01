'use client'

import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { type Event, type Property, type LookalikeRange } from '@/types/events'
import { convertToLocalTimeISO } from '@/lib/utils'

interface BackfillEventState {
  event: Event
  isSubmitting: boolean
  error: string | null
}

interface BackfillEventActions {
  // Event actions
  updateEvent: (field: keyof Omit<Event, "properties">, value: string) => void
  updateEventField: <K extends 'event_name' | 'timestamp' | 'external_customer_id' | 'animatingSubmission'>(
    fieldName: K, 
    value: K extends 'animatingSubmission' ? boolean : string
  ) => void;
  
  // Property actions
  addProperty: () => void
  updateProperty: (
    propertyIndex: number,
    field: keyof Property,
    value: string | boolean | string[] | LookalikeRange | undefined
  ) => void
  removeProperty: (propertyIndex: number) => void
  
  // Form state
  setIsSubmitting: (isSubmitting: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
  
  // Form preservation actions (similar to events store)
  markEventAsSubmitted: () => void
  regenerateIdempotencyKey: () => void
}

type BackfillEventStore = BackfillEventState & BackfillEventActions

const createInitialEvent = (): Event => ({
  event_name: "",
  timestamp: convertToLocalTimeISO(new Date()),
  properties: [],
  idempotency_key: uuidv4(),
  external_customer_id: "",
  submitted: false,
})

export const useBackfillEventStore = create<BackfillEventStore>((set) => ({
  // Initial state
  event: createInitialEvent(),
  isSubmitting: false,
  error: null,

  // Event actions
  updateEvent: (field, value) => set((state) => ({
    event: { ...state.event, [field]: value }
  })),

  updateEventField: <K extends "event_name" | "timestamp" | "external_customer_id" | "animatingSubmission">(
    fieldName: K, 
    value: K extends "animatingSubmission" ? boolean : string
  ) => 
    set((state) => ({
      event: { ...state.event, [fieldName]: value }
    })),

  // Property actions
  addProperty: () => set((state) => ({
    event: {
      ...state.event,
      properties: [
        ...state.event.properties,
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
  })),

  updateProperty: (propertyIndex, field, value) => set((state) => ({
    event: {
      ...state.event,
      properties: state.event.properties.map((prop, idx) => {
        if (idx === propertyIndex) {
          const updatedProp = { ...prop, [field]: value };

          // Handle lookalike type changes
          if (field === "lookalikeType") {
            if (value === "set") {
              updatedProp.lookalikeRange = undefined;
              updatedProp.lookalikeValues = [];
            } else if (value === "range") {
              updatedProp.lookalikeValues = undefined;
              updatedProp.lookalikeRange = { min: 0, max: 0 };
            }
          }

          // Clear lookalike values when isLookalike is set to false
          if (field === "isLookalike" && !value) {
            updatedProp.lookalikeType = undefined;
            updatedProp.lookalikeValues = undefined;
            updatedProp.lookalikeRange = undefined;
          }

          return updatedProp;
        }
        return prop;
      })
    }
  })),

  removeProperty: (propertyIndex) => set((state) => ({
    event: {
      ...state.event,
      properties: state.event.properties.filter((_, idx) => idx !== propertyIndex)
    }
  })),

  // Form state
  setIsSubmitting: (isSubmitting) => set({
    isSubmitting
  }),

  setError: (error) => set({
    error
  }),

  reset: () => set({
    event: createInitialEvent(),
    isSubmitting: false,
    error: null
  }),

  // Form preservation actions (similar to events store)
  markEventAsSubmitted: () => 
    set(state => ({
      event: { 
        ...state.event, 
        submitted: true,
        animatingSubmission: true,
        lastSubmittedAt: new Date().toISOString()
      }
    })),

  regenerateIdempotencyKey: () => set((state) => ({
    event: {
      ...state.event,
      idempotency_key: uuidv4(), // Generate a new UUID
    }
  })),
}))