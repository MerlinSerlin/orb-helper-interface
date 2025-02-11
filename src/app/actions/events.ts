// app/actions/events.ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const ORB_API_URL = 'https://api.withorb.com/v1/ingest?debug=true'
const ORB_API_TOKEN = process.env.ORB_API_TOKEN

// Zod schemas for validation
const PropertySchema = z.record(z.union([z.string(), z.number()]))

const EventSchema = z.object({
  idempotency_key: z.string(),
  external_customer_id: z.string(),
  event_name: z.string(),
  properties: PropertySchema,
  timestamp: z.string()
})

const RequestSchema = z.object({
  events: z.array(EventSchema)
})

export type ServerActionResponse = {
  success: boolean
  message: string
  count?: number
  orbResponse?: any
  error?: any
}

export async function submitEvents(events: z.infer<typeof RequestSchema>['events']): Promise<ServerActionResponse> {
  if (!ORB_API_TOKEN) {
    console.error('ORB_API_TOKEN is not set in the environment variables')
    return {
      success: false,
      message: 'Server configuration error'
    }
  }

  try {
    // Validate the request body using Zod
    const validatedData = RequestSchema.parse({ events })

    // Make the request to the Orb API
    const orbResponse = await fetch(ORB_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ORB_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validatedData),
    })

    if (!orbResponse.ok) {
      const errorData = await orbResponse.json()
      console.error('Error from Orb API:', errorData)
      
      return {
        success: false,
        message: 'Error from Orb API',
        error: errorData
      }
    }

    const orbData = await orbResponse.json()
    
    // Optionally revalidate any paths that might be caching this data
    revalidatePath('/events')
    
    return {
      success: true,
      message: 'Events processed successfully',
      count: events.length,
      orbResponse: orbData
    }

  } catch (error) {
    console.error('Error processing events:', error)
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: 'Validation error',
        error: error.errors
      }
    }

    return {
      success: false,
      message: 'Internal Server Error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}