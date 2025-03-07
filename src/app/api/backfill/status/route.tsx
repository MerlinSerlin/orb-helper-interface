// This route is not currently in use. This would be for logging backfill status updates to the webapp. Currently we are logging to the terminal.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import fs from 'fs/promises'
import path from 'path'

type JobStatusUpdate = z.infer<typeof statusUpdateSchema>;

// Define the status update schema
const statusUpdateSchema = z.object({
  jobId: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  progress: z.number().min(0).max(100).optional(),
  message: z.string().optional(),
  updatedAt: z.string().optional(),
  totalEvents: z.number().optional(),
  processedEvents: z.number().optional(),
  error: z.string().optional()
})

// Simple file-based storage for job status
// In a production app, you'd use a database instead
async function updateJobInStorage(jobId: string, updates: Partial<JobStatusUpdate>){
  try {
    const rootDir = process.cwd()
    const storageDir = path.join(rootDir, 'tmp', 'job-status')
    
    // Ensure the directory exists
    await fs.mkdir(storageDir, { recursive: true })
    
    // The file path for this job's status
    const statusFilePath = path.join(storageDir, `${jobId}.json`)
    
    // Try to read existing data first
    let jobData = {}
    try {
      const existingData = await fs.readFile(statusFilePath, 'utf-8')
      jobData = JSON.parse(existingData)
    } catch {
      // File probably doesn't exist yet, which is fine
    }
    
    // Update with new data
    const updatedData = {
      ...jobData,
      ...updates,
      updatedAt: new Date().toISOString()
    }
    
    // Write back to file
    await fs.writeFile(statusFilePath, JSON.stringify(updatedData, null, 2))
    
    return true
  } catch (error) {
    console.error('Error updating job status in storage:', error)
    return false
  }
}

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json()
    
    // Validate against the schema
    const result = statusUpdateSchema.safeParse(body)
    
    if (!result.success) {
      console.error('Invalid status update payload:', result.error)
      return NextResponse.json(
        { success: false, message: 'Invalid status update payload' },
        { status: 400 }
      )
    }
    
    const { jobId, status, progress, message, updatedAt, totalEvents, processedEvents, error } = result.data
    
    console.log('Received status update:', {
      jobId,
      status,
      progress,
      message,
      totalEvents,
      processedEvents,
      error,
      updatedAt: updatedAt || new Date().toISOString()
    })
    
    // Store the update
    const success = await updateJobInStorage(jobId, {
      status,
      progress,
      message,
      totalEvents,
      processedEvents,
      error,
      updatedAt: updatedAt || new Date().toISOString()
    })
    
    if (!success) {
      return NextResponse.json(
        { success: false, message: 'Failed to update job status' },
        { status: 500 }
      )
    }
    
    // Broadcast the update to connected clients via Server-Sent Events
    // This would require additional setup for SSE
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Error processing status update:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Optional: Add a GET endpoint to retrieve job status
export async function GET(request: Request) {
  const url = new URL(request.url)
  const jobId = url.searchParams.get('jobId')
  
  if (!jobId) {
    return NextResponse.json(
      { success: false, message: 'Job ID is required' },
      { status: 400 }
    )
  }
  
  try {
    const rootDir = process.cwd()
    const statusFilePath = path.join(rootDir, 'tmp', 'job-status', `${jobId}.json`)
    
    const data = await fs.readFile(statusFilePath, 'utf-8')
    const jobStatus = JSON.parse(data)
    
    return NextResponse.json({ success: true, data: jobStatus })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Job status not found' },
      { status: 404 }
    )
  }
}