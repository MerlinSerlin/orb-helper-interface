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