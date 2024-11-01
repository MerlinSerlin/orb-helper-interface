'use client'

import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type Property = {
  key: string
  value: string
}

type Event = {
  event_name: string
  timestamp: string
  properties: Property[]
  idempotency_key: string
  external_customer_id: string
}

export default function Component() {
  const convertToLocalTimeISO = (isoTimestamp: Date): string => {
    const offsetMillis = isoTimestamp.getTimezoneOffset() * 60000; // Timezone offset in milliseconds
    const localISOTime = new Date(isoTimestamp.getTime() - offsetMillis).toISOString().slice(0, 19); // Trimming milliseconds
    return localISOTime;
  }

  const [events, setEvents] = useState<Event[]>([{
    event_name: '',
    timestamp: convertToLocalTimeISO(new Date()),
    properties: [],
    idempotency_key: uuidv4(),
    external_customer_id: ''
  }])
  const [autoEventCount, setAutoEventCount] = useState<string>('0')
  const [generatedEventCount, setGeneratedEventCount] = useState(0)
  const [apiResponse, setApiResponse] = useState<string | null>(null)

  const addEvent = () => {
    setEvents([...events, {
      event_name: '',
      timestamp: convertToLocalTimeISO(new Date()),
      properties: [],
      idempotency_key: uuidv4(),
      external_customer_id: ''
    }])
  }

  const updateEvent = (index: number, field: keyof Omit<Event, 'properties'>, value: string) => {
    const newEvents = [...events]
    newEvents[index] = { ...newEvents[index], [field]: value }
    setEvents(newEvents)
  }

  const removeEvent = (index: number) => {
    const newEvents = [...events]
    newEvents.splice(index, 1)
    setEvents(newEvents)
  }

  const addProperty = (eventIndex: number) => {
    const newEvents = [...events]
    newEvents[eventIndex].properties.push({ key: '', value: '' })
    setEvents(newEvents)
  }

  const updateProperty = (eventIndex: number, propertyIndex: number, field: keyof Property, value: string) => {
    const newEvents = [...events]
    newEvents[eventIndex] = {
      ...newEvents[eventIndex],
      properties: newEvents[eventIndex].properties.map((prop, index) =>
        index === propertyIndex ? { ...prop, [field]: value } : prop
      )
    }
    setEvents(newEvents)
  }

  const removeProperty = (eventIndex: number, propertyIndex: number) => {
    const newEvents = [...events]
    newEvents[eventIndex] = {
      ...newEvents[eventIndex],
      properties: newEvents[eventIndex].properties.filter((_, index) => index !== propertyIndex)
    }
    setEvents(newEvents)
  }

  const resetEvents = () => {
    setEvents([{
      event_name: '',
      timestamp: convertToLocalTimeISO(new Date()),
      properties: [],
      idempotency_key: uuidv4(),
      external_customer_id: ''
    }])
  }

  const generateLookalikeEvents = (templateEvent: Event, count: number): Event[] => {
    return Array.from({ length: count }, () => ({
      ...templateEvent,
      idempotency_key: uuidv4(),
      timestamp: new Date(templateEvent.timestamp).toISOString()
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setApiResponse(null)

    // Validate required fields
    const isValid = events.every(event => 
      event.event_name && event.timestamp && event.external_customer_id
    )
    if (!isValid) {
      setApiResponse('Please fill in all required fields (Event Name, Timestamp, and External Customer ID)')
      return
    }

    // Generate lookalike events
    const allEvents = [
      ...events,
      ...generateLookalikeEvents(events[events.length - 1], generatedEventCount)
    ]

    // Convert properties array to object
    const formattedEvents = allEvents.map(event => ({
      ...event,
      properties: Object.fromEntries(event.properties.map(prop => [prop.key, prop.value])),
      // Convert timestamps to ISO8601UTC format
      timestamp: new Date(event.timestamp).toISOString()
    }))

    try {
      const response = await fetch('/api/send-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events: formattedEvents }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to submit events')
      }

      setApiResponse(`Successfully processed ${result.count} events. Orb API Response: ${JSON.stringify(result.orbResponse)}`)
      resetEvents()
    } catch (error) {
      console.error('Error submitting events:', error)
      setApiResponse(`Failed to submit events: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl mx-auto">
        {events.map((event, eventIndex) => (
          <Card key={event.idempotency_key} className="w-full">
            <CardHeader>
              <CardTitle>Event {eventIndex + 1}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Other inputs remain the same */}
              <div className="space-y-2">
                <Label htmlFor={`event-name-${eventIndex}`}>Event Name *</Label>
                <Input
                  id={`event-name-${eventIndex}`}
                  value={event.event_name}
                  onChange={(e) => updateEvent(eventIndex, 'event_name', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`timestamp-${eventIndex}`}>Timestamp *</Label>
                <Input
                  id={`timestamp-${eventIndex}`}
                  type="datetime-local"
                  value={event.timestamp.slice(0, 16)} // Only show date and time for input
                  onChange={(e) => {
                    const localDate = new Date(e.target.value);
                    const isoTimestamp = convertToLocalTimeISO(localDate);
                    updateEvent(eventIndex, 'timestamp', isoTimestamp);
                  }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`external-customer-id-${eventIndex}`}>External Customer ID *</Label>
                <Input
                  id={`external-customer-id-${eventIndex}`}
                  value={event.external_customer_id}
                  onChange={(e) => updateEvent(eventIndex, 'external_customer_id', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Idempotency Key (auto-generated)</Label>
                <Input value={event.idempotency_key} disabled />
              </div>
              <div className="space-y-2">
                <Label>Properties</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead className="w-[100px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {event.properties.map((prop, propIndex) => (
                      <TableRow key={propIndex}>
                        <TableCell>
                          <Input
                            placeholder="Key"
                            value={prop.key}
                            onChange={(e) => updateProperty(eventIndex, propIndex, 'key', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Value"
                            value={prop.value}
                            onChange={(e) => updateProperty(eventIndex, propIndex, 'value', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Button 
                            type="button" 
                            variant="destructive" 
                            onClick={() => removeProperty(eventIndex, propIndex)}
                            className="w-full"
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Button type="button" onClick={() => addProperty(eventIndex)} className="w-full">
                  Add Property
                </Button>
              </div>
              {/* Add the remove button only if it's not the first event */}
              {eventIndex > 0 && (
                <div className="flex justify-end">
                  <Button 
                    type="button" 
                    variant="destructive" 
                    onClick={() => removeEvent(eventIndex)}
                  >
                    Remove Event
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        <div className="flex justify-between items-center">
          <Button type="button" onClick={addEvent}>Add Another Event</Button>
          <Button type="submit">Submit</Button>
        </div>
        <Card className="w-full mt-8">
          <CardHeader>
            <CardTitle>Generate Lookalike Events</CardTitle>
          </CardHeader>
          {/* <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <Label htmlFor="auto-event-count">Number of lookalike events to generate:</Label>
              <Select value={autoEventCount} onValueChange={(value) => {
                setAutoEventCount(value)
                setGeneratedEventCount(parseInt(value))
              }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select count" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 21 }, (_, i) => i).map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p>
              {generatedEventCount > 0 
                ? `${generatedEventCount} lookalike event${generatedEventCount > 1 ? 's' : ''} will be generated and included in the submission.`
                : 'No lookalike events will be generated.'}
            </p>
          </CardContent> */}
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <Label htmlFor="auto-event-count">Number of lookalike events to generate:</Label>
              <Select value={autoEventCount} onValueChange={(value) => {
                setAutoEventCount(value);
                setGeneratedEventCount(parseInt(value));
              }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select count" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p>
              {generatedEventCount > 0 
                ? `${generatedEventCount} lookalike event${generatedEventCount > 1 ? 's' : ''} will be generated and included in the submission.`
                : 'No lookalike events will be generated.'}
            </p>
          </CardContent>
        </Card>
        {apiResponse && (
          <Alert>
            <AlertTitle>API Response</AlertTitle>
            <AlertDescription>{apiResponse}</AlertDescription>
          </Alert>
        )}
      </form>
    </div>
  )
}
