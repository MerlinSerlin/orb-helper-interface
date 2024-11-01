'use client'

import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Property {
  key: string
  value: string
}

interface EventProperties {
  [key: string]: string
}

interface Event {
  event_name: string
  timestamp: string
  properties: Property[]
  idempotency_key: string
  external_customer_id: string
}

interface FormattedEvent extends Omit<Event, 'properties'> {
  properties: EventProperties
}

export default function Component() {
  const [events, setEvents] = useState<Event[]>([{
    event_name: '',
    timestamp: '',
    properties: [],
    idempotency_key: uuidv4(),
    external_customer_id: ''
  }])

  const addEvent = () => {
    setEvents([...events, {
      event_name: '',
      timestamp: '',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    const isValid = events.every(event => 
      event.event_name && event.timestamp && event.external_customer_id
    );
    if (!isValid) {
      alert('Please fill in all required fields (Event Name, Timestamp, and External Customer ID)');
      return;
    }
    
    // Convert timestamps to ISO8601 format (UTC) and properties array to an object
    const eventsWithFormattedProperties: FormattedEvent[] = events.map(event => ({
      ...event,
      timestamp: new Date(event.timestamp).toISOString(),
      properties: event.properties.reduce<EventProperties>((acc, prop) => {
        acc[prop.key] = prop.value;
        return acc;
      }, {})
    }));
  
    try {
      const response = await fetch('/api/send-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events: eventsWithFormattedProperties }),
      });
    
      if (!response.ok) {
        throw new Error('Failed to submit events');
      }
    
      const result = await response.json();
      console.log('API Response:', result);
      alert(`Successfully processed ${result.count} events`);
    } catch (error) {
      console.error('Error submitting events:', error);
      alert('Failed to submit events. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {events.map((event, eventIndex) => (
        <Card key={event.idempotency_key} className="w-full">
          <CardHeader>
            <CardTitle>Event {eventIndex + 1}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                value={event.timestamp}
                onChange={(e) => updateEvent(eventIndex, 'timestamp', e.target.value)}
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
              {event.properties.map((prop, propIndex) => (
                <div key={propIndex} className="flex space-x-2">
                  <Input
                    placeholder="Key"
                    value={prop.key}
                    onChange={(e) => updateProperty(eventIndex, propIndex, 'key', e.target.value)}
                  />
                  <Input
                    placeholder="Value"
                    value={prop.value}
                    onChange={(e) => updateProperty(eventIndex, propIndex, 'value', e.target.value)}
                  />
                  <Button type="button" variant="destructive" onClick={() => removeProperty(eventIndex, propIndex)}>
                    Remove
                  </Button>
                </div>
              ))}
              <Button type="button" onClick={() => addProperty(eventIndex)}>Add Property</Button>
            </div>
          </CardContent>
        </Card>
      ))}
      <div className="flex justify-between">
        <Button type="button" onClick={addEvent}>Add Another Event</Button>
        <Button type="submit">Submit</Button>
      </div>
    </form>
  )
}