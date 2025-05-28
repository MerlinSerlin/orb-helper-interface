// lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { v4 as uuidv4 } from "uuid"
import type { Event as CustomEvent } from "@/types/events" // Import with alias to avoid collision

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function convertToLocalTimeISO(isoTimestamp: Date): string {
  const offsetMillis = isoTimestamp.getTimezoneOffset() * 60000; // Timezone offset in milliseconds
  const localISOTime = new Date(isoTimestamp.getTime() - offsetMillis).toISOString().slice(0, 19); // Trimming milliseconds
  return localISOTime;
}

// Generate lookalike events
export const generateLookalikeEvents = (templateEvent: CustomEvent, count: number): CustomEvent[] => {
  return Array.from({ length: count }, () => ({
    ...templateEvent,
    idempotency_key: uuidv4(),
    timestamp: new Date(templateEvent.timestamp).toISOString(),
    properties: templateEvent.properties.map((prop) => {
      if (prop.isLookalike) {
        if (prop.lookalikeType === "set" && prop.lookalikeValues) {
          return {
            ...prop,
            value: prop.lookalikeValues[Math.floor(Math.random() * prop.lookalikeValues.length)],
          }
        } else if (prop.lookalikeType === "range" && prop.lookalikeRange) {
          const { min, max } = prop.lookalikeRange
          return {
            ...prop,
            value: String(Math.floor(Math.random() * (max - min + 1) + min)),
          }
        }
      }
      
      // Handle UUID properties
      if (prop.useUUID) {
        return {
          ...prop,
          value: uuidv4(),
        }
      }
      
      return prop
    }),
  }))
}

// lib/utils.ts - date validation functions

/**
 * Get the minimum allowed date for backfills (90 days in the past)
 */
export function getMinimumBackfillDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 90);
  return date.toISOString().split('T')[0]; // Return YYYY-MM-DD
}

/**
 * Get the maximum allowed date for backfills (today)
 */
export function getMaximumBackfillDate(): string {
  const date = new Date();
  
  // Add a 2-day grace period requirement
  date.setDate(date.getDate() - 2);
  
  return date.toISOString().split('T')[0]; // Return YYYY-MM-DD
}

/**
 * Extract just the date part from a datetime string
 */
export function getDatePart(dateTimeStr: string): string {
  if (!dateTimeStr) return '';
  return dateTimeStr.split('T')[0];
}

/**
 * Validate the start date
 */
export function validateStartDate(dateStr: string): { isValid: boolean; errorMessage?: string } {
  if (!dateStr) {
    return { isValid: false, errorMessage: 'Start date is required' };
  }

  const datePart = getDatePart(dateStr);
  
  // Create Date objects
  const date = new Date(datePart);
  const minDate = new Date(getMinimumBackfillDate());
  const maxDate = new Date(getMaximumBackfillDate());
  
  // Handle invalid date
  if (isNaN(date.getTime())) {
    return { isValid: false, errorMessage: 'Invalid date format' };
  }
  
  // Check if date is within allowed range
  if (date < minDate) {
    return { 
      isValid: false, 
      errorMessage: 'Start date cannot be more than 90 days in the past' 
    };
  }
  
  if (date > maxDate) {
    return { 
      isValid: false, 
      errorMessage: 'Start date must be at least 2 days in the past'
    };
  }
  
  return { isValid: true };
}

/**
 * Validate the end date
 */
export function validateEndDate(
  dateStr: string, 
  startDateStr: string
): { isValid: boolean; errorMessage?: string } {
  if (!dateStr) {
    return { isValid: false, errorMessage: 'End date is required' };
  }
  
  if (!startDateStr) {
    return { isValid: false, errorMessage: 'Please set a start date first' };
  }

  const endDatePart = getDatePart(dateStr);
  const startDatePart = getDatePart(startDateStr);
  
  // Create Date objects
  const endDate = new Date(endDatePart);
  const startDate = new Date(startDatePart);
  const maxDate = new Date(getMaximumBackfillDate());
  
  // Handle invalid date
  if (isNaN(endDate.getTime())) {
    return { isValid: false, errorMessage: 'Invalid date format' };
  }
  
  // Check if end date is after start date
  if (endDate < startDate) {
    return { 
      isValid: false, 
      errorMessage: 'End date must be on or after the start date' 
    };
  }
  
  // Check if end date is in the future or violates grace period
  if (endDate > maxDate) {
    return { 
      isValid: false, 
      errorMessage: 'End date must be at least 2 days in the past'
    };
  }
  
  return { isValid: true };
}

