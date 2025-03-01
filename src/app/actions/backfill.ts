// src/app/actions/backfill.ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { writeFile } from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Define validation schema for backfill job
const BackfillJobSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  eventType: z.string().min(1, "Event type is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
})

export type ServerActionResponse = {
  success: boolean;
  message: string;
  jobId?: string;
  error?: unknown;
}

// Function to save uploaded file
async function saveFile(file: File): Promise<string> {
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  
  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(process.cwd(), 'uploads')
  
  // Generate unique filename
  const filename = `${Date.now()}-${file.name}`
  const filepath = path.join(uploadsDir, filename)
  
  // Write file to disk
  await writeFile(filepath, buffer)
  
  return filepath
}

export async function submitBackfillJob(formData: FormData): Promise<ServerActionResponse> {
  try {
    // Get form data
    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const eventType = formData.get('eventType') as string
    const startDate = formData.get('startDate') as string
    const endDate = formData.get('endDate') as string
    const file = formData.get('file') as File | null
    
    // Validate job data
    const jobData = {
      name,
      description,
      eventType,
      startDate,
      endDate,
    }
    
    const validatedData = BackfillJobSchema.parse(jobData)
    
    // Process file if provided
    let filePath: string | undefined
    if (file && file.size > 0) {
      filePath = await saveFile(file)
    }
    
    // Here, you would typically call your Python script
    // For example:
    // await execAsync(`python backfill_events.py --event-type ${eventType} --start-date ${startDate} --end-date ${endDate} --file ${filePath}`)
    
    // For now, we'll just simulate this by returning success
    
    revalidatePath('/backfill')
    
    return {
      success: true,
      message: 'Backfill job submitted successfully',
      jobId: Date.now().toString(), // This would typically be returned by your actual backend
    }
    
  } catch (error) {
    console.error('Error submitting backfill job:', error)
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: 'Validation error',
        error: error.errors
      }
    }
    
    return {
      success: false,
      message: 'Failed to submit backfill job',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// This would be used to check the status of a running backfill job
export async function checkBackfillStatus(jobId: string): Promise<ServerActionResponse> {
  try {
    // In a real application, you would check the status of your Python script
    // or the database record for the job
    
    // For now, we'll simulate this with a random progress
    const progress = Math.random()
    const isComplete = progress >= 1
    
    return {
      success: true,
      message: isComplete ? 'Backfill job complete' : 'Backfill job in progress',
    }
    
  } catch (error) {
    console.error('Error checking backfill status:', error)
    
    return {
      success: false,
      message: 'Failed to check backfill status',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}