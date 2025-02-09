"use client"

import { useState, Fragment } from "react"
import { v4 as uuidv4 } from "uuid"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { convertToLocalTimeISO } from "@/lib/utils"

type Event = {
  event_name: string
  timestamp: string
  properties: Property[]
  idempotency_key: string
  external_customer_id: string
}

type Property = {
  key: string;
  value: string;
  isLookalike: boolean;  // Change from optional to required, defaulting to false
  lookalikeType?: "set" | "range";
  lookalikeValues?: string[];
  lookalikeRange?: LookalikeRange;
  [key: string]: string | boolean | string[] | LookalikeRange | undefined;
}

type LookalikeRange = {
  min: number;
  max: number;
};

export default function Component() {
  const [events, setEvents] = useState<Event[]>([
    {
      event_name: "",
      timestamp: convertToLocalTimeISO(new Date()),
      properties: [],
      idempotency_key: uuidv4(),
      external_customer_id: "",
    },
  ])
  const [autoEventCount, setAutoEventCount] = useState<string>("0")
  const [generatedEventCount, setGeneratedEventCount] = useState(0)
  const [apiResponse, setApiResponse] = useState<string | null>(null)

  const addEvent = () => {
    setEvents([
      ...events,
      {
        event_name: "",
        timestamp: convertToLocalTimeISO(new Date()),
        properties: [],
        idempotency_key: uuidv4(),
        external_customer_id: "",
      },
    ])
  }

  const updateEvent = (index: number, field: keyof Omit<Event, "properties">, value: string) => {
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
    const newProperty = {
      key: "",
      value: "",
      isLookalike: false,
      lookalikeType: undefined,
      lookalikeValues: undefined,
      lookalikeRange: undefined
    }
    newEvents[eventIndex].properties.push(newProperty)
    setEvents(newEvents)
  }

  const updateProperty = (
    eventIndex: number,
    propertyIndex: number,
    field: keyof Property,
    value: string | boolean | LookalikeRange | string[] | undefined,
  ) => {
    // console.log('updateProperty called:', { field, value }); // Debug log
    const newEvents = [...events];
    const updatedProperty = { ...newEvents[eventIndex].properties[propertyIndex] } as Property;
  
    if (field === "lookalikeType") {
      updatedProperty.lookalikeType = value as "set" | "range";
      // Clear the previous values when switching types
      if (value === "set") {
        updatedProperty.lookalikeRange = undefined;
        updatedProperty.lookalikeValues = [];
      } else if (value === "range") {
        updatedProperty.lookalikeValues = undefined;
        updatedProperty.lookalikeRange = { min: 0, max: 0 };
      }
    } else if (field === "lookalikeRange") {
      updatedProperty.lookalikeRange = value as LookalikeRange;
    } else if (field === "lookalikeValues") {
      updatedProperty.lookalikeValues = value as string[];
    } else if (field === "isLookalike") {
      updatedProperty.isLookalike = Boolean(value);
      if (!value) {
        updatedProperty.lookalikeType = undefined;
        updatedProperty.lookalikeValues = undefined;
        updatedProperty.lookalikeRange = undefined;
      }
    } else {
      updatedProperty[field] = value as string;
    }
  
    newEvents[eventIndex] = {
      ...newEvents[eventIndex],
      properties: newEvents[eventIndex].properties.map((prop, index) =>
        index === propertyIndex ? updatedProperty : prop
      ),
    };
  
    setEvents(newEvents);
  };

  const removeProperty = (eventIndex: number, propertyIndex: number) => {
    const newEvents = [...events]
    newEvents[eventIndex] = {
      ...newEvents[eventIndex],
      properties: newEvents[eventIndex].properties.filter((_, index) => index !== propertyIndex),
    }
    setEvents(newEvents)
  }

  const resetEvents = () => {
    setEvents([
      {
        event_name: "",
        timestamp: convertToLocalTimeISO(new Date()),
        properties: [],
        idempotency_key: uuidv4(),
        external_customer_id: "",
      },
    ])
  }

  const generateLookalikeEvents = (templateEvent: Event, count: number): Event[] => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setApiResponse(null)

    const isValid = events.every((event) => event.event_name && event.timestamp && event.external_customer_id)
    if (!isValid) {
      setApiResponse("Please fill in all required fields (Event Name, Timestamp, and External Customer ID)")
      return
    }

    const allEvents = [...events, ...generateLookalikeEvents(events[events.length - 1], generatedEventCount)]

    const formattedEvents = allEvents.map((event) => ({
      ...event,
      properties: Object.fromEntries(event.properties.map((prop) => [prop.key, prop.value])),
      timestamp: new Date(event.timestamp).toISOString(),
    }))

    try {
      const response = await fetch("/api/send-events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ events: formattedEvents }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || "Failed to submit events")
      }

      setApiResponse(
        `Successfully processed ${result.count} events. Orb API Response: ${JSON.stringify(result.orbResponse)}`,
      )
      resetEvents()
    } catch (error) {
      console.error("Error submitting events:", error)
      setApiResponse(`Failed to submit events: ${error instanceof Error ? error.message : "Unknown error"}`)
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
              <div className="space-y-2">
                <Label htmlFor={`event-name-${eventIndex}`}>Event Name *</Label>
                <Input
                  id={`event-name-${eventIndex}`}
                  value={event.event_name}
                  onChange={(e) => updateEvent(eventIndex, "event_name", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`timestamp-${eventIndex}`}>Timestamp *</Label>
                <Input
                  id={`timestamp-${eventIndex}`}
                  type="datetime-local"
                  value={event.timestamp.slice(0, 16)}
                  onChange={(e) => {
                    const localDate = new Date(e.target.value)
                    const isoTimestamp = convertToLocalTimeISO(localDate)
                    updateEvent(eventIndex, "timestamp", isoTimestamp)
                  }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`external-customer-id-${eventIndex}`}>External Customer ID *</Label>
                <Input
                  id={`external-customer-id-${eventIndex}`}
                  value={event.external_customer_id}
                  onChange={(e) => updateEvent(eventIndex, "external_customer_id", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`idempotency-key-${eventIndex}`}>Idempotency Key (auto-generated)</Label>
                <Input 
                  id={`idempotency-key-${eventIndex}`}
                  name={`idempotency-key-${eventIndex}`}
                  value={event.idempotency_key} 
                  disabled 
                />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium leading-none">Properties</h3>
                <Table aria-label={`Properties for Event ${eventIndex + 1}`}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Options</TableHead>
                      <TableHead className="w-[100px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {event.properties.map((prop, propIndex) => (
                      <Fragment key={`${eventIndex}-${propIndex}`}>
                        <TableRow>
                          <TableCell>
                            <Input
                              id={`property-key-${eventIndex}-${propIndex}`}
                              name={`property-key-${eventIndex}-${propIndex}`}
                              placeholder="Key"
                              value={prop.key}
                              onChange={(e) => updateProperty(eventIndex, propIndex, "key", e.target.value)}
                              aria-label="Property Key"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              id={`property-value-${eventIndex}-${propIndex}`}
                              name={`property-value-${eventIndex}-${propIndex}`}
                              placeholder="Value"
                              value={prop.value}
                              onChange={(e) => updateProperty(eventIndex, propIndex, "value", e.target.value)}
                              aria-label="Property Value"
                            />
                          </TableCell>
                          <TableCell>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`lookalike-checkbox-${eventIndex}-${propIndex}`}
                              name={`lookalike-checkbox-${eventIndex}-${propIndex}`}
                              checked={Boolean(prop.isLookalike)}
                              disabled={!prop.key} // Disable if no key is entered
                              onChange={(e) => {
                                const isChecked = e.target.checked;
                                const newEvents = [...events];
                                const updatedProperty = { ...newEvents[eventIndex].properties[propIndex] } as Property;
                                
                                updatedProperty.isLookalike = isChecked;
                                if (isChecked) {
                                  updatedProperty.lookalikeType = "set";
                                } else {
                                  updatedProperty.lookalikeType = undefined;
                                  updatedProperty.lookalikeValues = undefined;
                                  updatedProperty.lookalikeRange = undefined;
                                }

                                newEvents[eventIndex] = {
                                  ...newEvents[eventIndex],
                                  properties: newEvents[eventIndex].properties.map((prop, index) =>
                                    index === propIndex ? updatedProperty : prop
                                  ),
                                };

                                setEvents(newEvents);
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600"
                            />
                            <Label 
                              htmlFor={`lookalike-checkbox-${eventIndex}-${propIndex}`}
                              className={`text-sm ${!prop.key ? 'text-muted-foreground/50' : 'text-muted-foreground'}`} // Dim the label if disabled
                            >
                              Randomize values for lookalike
                            </Label>
                          </div>
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
                        {(prop.isLookalike === true) && (
                          <TableRow>
                            <TableCell colSpan={4}>
                              <div className="space-y-2">
                                <p className="text-sm font-medium leading-none">
                                  Select lookalike type for {prop.key}
                                </p>
                                <Select
                                  name={`lookalike-type-${eventIndex}-${propIndex}`}
                                  value={prop.lookalikeType || "set"}
                                  onValueChange={(value) => {
                                    // console.log('Selected value:', value); // Debug log
                                    updateProperty(eventIndex, propIndex, "lookalikeType", value as "set" | "range");
                                  }}
                                >
                                  <SelectTrigger 
                                    id={`lookalike-type-select-${eventIndex}-${propIndex}`}
                                    aria-label={`Select lookalike type for ${prop.key}`}
                                  >
                                    <SelectValue placeholder={`Select lookalike type for ${prop.key}`} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="set">Set of Values</SelectItem>
                                    <SelectItem value="range">Range of Integers</SelectItem>
                                  </SelectContent>
                                </Select>

                                {prop.lookalikeType === "set" && (
                                  <div>
                                    <Input
                                      id={`lookalike-values-${eventIndex}-${propIndex}`}
                                      name={`lookalike-values-${eventIndex}-${propIndex}`}
                                      placeholder={`Enter values for ${prop.key} separated by commas, e.g., "apple, banana, cherry"`}
                                      value={prop.lookalikeValues?.join(", ") || ""}
                                      onChange={(e) =>
                                        updateProperty(
                                          eventIndex,
                                          propIndex,
                                          "lookalikeValues",
                                          e.target.value.split(",").map((v) => v.trim())
                                        )
                                      }
                                    />
                                  </div>
                                )}

                                {prop.lookalikeType === "range" && (
                                  <div className="space-y-2">
                                    <div className="flex space-x-2">
                                      <div className="space-y-1">
                                      <Label htmlFor={`range-min-${eventIndex}-${propIndex}`}>
                                        Enter minimum value for {prop.key}
                                      </Label>
                                        <Input
                                          type="number"
                                          id={`range-min-${eventIndex}-${propIndex}`}
                                          name={`range-min-${eventIndex}-${propIndex}`}
                                          placeholder="Min"
                                          value={prop.lookalikeRange?.min || ""}
                                          onChange={(e) =>
                                            updateProperty(eventIndex, propIndex, "lookalikeRange", {
                                              min: Number(e.target.value),
                                              max: prop.lookalikeRange?.max ?? 0,
                                            })
                                          }
                                        />
                                      </div>
                                      <div className="space-y-1">
                                      <Label htmlFor={`range-min-${eventIndex}-${propIndex}`}>
                                        Enter maximum value for {prop.key}
                                      </Label>
                                        <Input
                                          type="number"
                                          id={`range-max-${eventIndex}-${propIndex}`}
                                          name={`range-max-${eventIndex}-${propIndex}`}
                                          placeholder="Max"
                                          value={prop.lookalikeRange?.max || ""}
                                          onChange={(e) =>
                                            updateProperty(eventIndex, propIndex, "lookalikeRange", {
                                              min: prop.lookalikeRange?.min ?? 0,
                                              max: Number(e.target.value),
                                            })
                                          }
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
                <Button type="button" onClick={() => addProperty(eventIndex)} className="w-full">
                  Add Property
                </Button>
              </div>
              {eventIndex > 0 && (
                <div className="flex justify-end">
                  <Button type="button" variant="destructive" onClick={() => removeEvent(eventIndex)}>
                    Remove Event
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        <div className="flex justify-between items-center">
          <Button type="button" onClick={addEvent}>
            Add Another Event
          </Button>
          <Button type="submit">Submit</Button>
        </div>
        <Card className="w-full mt-8">
          <CardHeader>
            <CardTitle>Generate Lookalike Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <Label htmlFor="auto-event-count-select">Number of lookalike events to generate:</Label>
            <Select
              name="auto-event-count"
              value={autoEventCount}
              onValueChange={(value) => {
                setAutoEventCount(value)
                setGeneratedEventCount(Number.parseInt(value))
              }}
            >
              <SelectTrigger id="auto-event-count-select" className="w-[180px]">
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
                ? `${generatedEventCount} lookalike event${generatedEventCount > 1 ? "s" : ""} will be generated and included in the submission.`
                : "No lookalike events will be generated."}
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











