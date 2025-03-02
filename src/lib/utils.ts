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
      return prop
    }),
  }))
}

/**
 * Validates if a date is within the allowed range (not more than 90 days in the past)
 * @param dateToCheck The date to validate
 * @returns Object containing validation result and error message if applicable
 */
export function validateBackfillDate(dateToCheck: string | Date): { isValid: boolean; errorMessage?: string } {
  // Calculate the date 90 days ago
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  
  // Convert the date to check to a Date object if it's a string
  const dateObj = typeof dateToCheck === 'string' ? new Date(dateToCheck) : dateToCheck
  
  // Check if the date is valid
  if (isNaN(dateObj.getTime())) {
    return { isValid: false, errorMessage: 'Invalid date format' }
  }
  
  // Check if the date is in the future
  const now = new Date()
  if (dateObj > now) {
    return { isValid: false, errorMessage: 'Date cannot be in the future' }
  }
  
  // Check if the date is more than 90 days in the past
  // Add a 5-minute buffer to prevent edge cases
  ninetyDaysAgo.setMinutes(ninetyDaysAgo.getMinutes() - 5) 
  if (dateObj < ninetyDaysAgo) {
    return { isValid: false, errorMessage: 'Start date cannot be more than 90 days in the past' }
  }
  
  return { isValid: true }
}

/**
 * Returns the minimum allowed date for backfills (90 days in the past)
 * @param format The format to return the date in
 * @returns The date 90 days ago in the specified format
 */
export function getMinimumBackfillDate(format: 'date' | 'iso' | 'iso-date' = 'iso-date'): string | Date {
  const date = new Date()
  date.setDate(date.getDate() - 90)
  
  if (format === 'date') {
    return date
  } else if (format === 'iso') {
    return date.toISOString() // Full ISO format
  } else {
    return date.toISOString().split('T')[0] // YYYY-MM-DD format
  }
}

/**
 * Returns the maximum allowed date for backfills (current date)
 * @param format The format to return the date in
 * @returns The current date in the specified format
 */
export function getMaximumBackfillDate(format: 'date' | 'iso' | 'iso-date' = 'iso-date'): string | Date {
  const date = new Date()
  
  if (format === 'date') {
    return date
  } else if (format === 'iso') {
    return date.toISOString() // Full ISO format
  } else {
    return date.toISOString().split('T')[0] // YYYY-MM-DD format
  }
}

/**
 * Validates the start date for a backfill
 * @param startDate The start date to validate
 * @returns Object containing validation status and error message if applicable
 */
export function validateStartDate(startDate: string): { isValid: boolean; errorMessage?: string } {
  if (!startDate) return { isValid: true }; // Empty is handled separately
  
  const dateObj = new Date(startDate);
  
  // Check if date is valid
  if (isNaN(dateObj.getTime())) {
    return { isValid: false, errorMessage: 'Invalid date format' };
  }
  
  // Check if date is in the future
  const now = new Date();
  if (dateObj > now) {
    return { isValid: false, errorMessage: 'Start date cannot be in the future' };
  }
  
  // Check if date is more than 90 days in the past
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  if (dateObj < ninetyDaysAgo) {
    return { isValid: false, errorMessage: 'Start date cannot be more than 90 days in the past' };
  }
  
  return { isValid: true };
}

/**
 * Validates the end date for a backfill
 * @param endDate The end date to validate
 * @param startDate The start date to compare with
 * @returns Object containing validation status and error message if applicable
 */
export function validateEndDate(endDate: string, startDate: string): { isValid: boolean; errorMessage?: string } {
  if (!endDate || !startDate) return { isValid: true }; // Empty is handled separately
  
  const endDateObj = new Date(endDate);
  const startDateObj = new Date(startDate);
  
  // Check if date is valid
  if (isNaN(endDateObj.getTime())) {
    return { isValid: false, errorMessage: 'Invalid date format' };
  }
  
  // Check if date is in the future
  const now = new Date();
  if (endDateObj > now) {
    return { isValid: false, errorMessage: 'End date cannot be in the future' };
  }
  
  // Check if end date is before start date
  if (endDateObj < startDateObj) {
    return { isValid: false, errorMessage: 'End date and time must be after start date and time' };
  }
  
  return { isValid: true };
}

/**
 * Extracts the date part from a datetime string
 * @param dateTimeString The datetime string in ISO format
 * @returns The date part of the string (YYYY-MM-DD)
 */
export function getDatePart(dateTimeString: string): string {
  if (!dateTimeString) return '';
  return dateTimeString.split('T')[0];
}

/**
 * Calculates the minimum end datetime based on the start datetime
 * @param startDate The start datetime
 * @param endDate The current end datetime
 * @returns The minimum valid end datetime
 */
export function getMinEndDateTime(startDate: string, endDate: string): string {
  if (!startDate) return '';
  
  // If end date is different than start date, no time restriction needed
  if (endDate && getDatePart(endDate) !== getDatePart(startDate)) {
    return `${getDatePart(endDate)}T00:00`;
  }
  
  // If same date, end time must be >= start time
  return startDate;
}