import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function convertToLocalTimeISO(isoTimestamp: Date): string {
  const offsetMillis = isoTimestamp.getTimezoneOffset() * 60000; // Timezone offset in milliseconds
  const localISOTime = new Date(isoTimestamp.getTime() - offsetMillis).toISOString().slice(0, 19); // Trimming milliseconds
  return localISOTime;
}
