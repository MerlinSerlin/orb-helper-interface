import { NextRequest, NextResponse } from 'next/server'

type Property = {
  [key: string]: string | number
}

type Event = {
  idempotency_key: string
  external_customer_id: string
  event_name: string
  properties: Property
  timestamp: string
}

type RequestBody = {
  events: Event[]
}

const ORB_API_URL = 'https://api.withorb.com/v1/ingest?debug=true'
const ORB_API_TOKEN = process.env.ORB_API_TOKEN

if (!ORB_API_TOKEN) {
  console.error('ORB_API_TOKEN is not set in the environment variables')
}

export async function POST(req: NextRequest) {
  if (!ORB_API_TOKEN) {
    return NextResponse.json({ message: 'Server configuration error' }, { status: 500 })
  }

  try {
    const body = await req.json() as RequestBody

    if (!body.events || !Array.isArray(body.events)) {
      return NextResponse.json({ message: 'Invalid request body: events array is required' }, { status: 400 })
    }

    // Validate each event
    for (const event of body.events) {
      if (!event.idempotency_key || !event.external_customer_id || !event.event_name || !event.timestamp) {
        return NextResponse.json({ message: 'Invalid event: missing required fields' }, { status: 400 })
      }

      if (typeof event.properties !== 'object') {
        return NextResponse.json({ message: 'Invalid event: properties must be an object' }, { status: 400 })
      }
    }

    // Make the request to the Orb API
    const orbResponse = await fetch(ORB_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ORB_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!orbResponse.ok) {
      const errorData = await orbResponse.json()
      console.error('Error from Orb API:', errorData)
      return NextResponse.json({ message: 'Error from Orb API', details: errorData }, { status: orbResponse.status })
    }

    const orbData = await orbResponse.json()

    // Send a success response
    return NextResponse.json({ message: 'Events processed successfully', count: body.events.length, orbResponse: orbData })
  } catch (error) {
    console.error('Error processing events:', error)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}