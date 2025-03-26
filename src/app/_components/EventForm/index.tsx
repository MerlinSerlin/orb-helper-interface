// app/_components/EventForm/index.tsx
'use client'

import { Fragment, useState, useEffect } from 'react'
import { useEventStore } from './store'
import { useEventSubmission } from './useEventSubmission'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'

export function EventForm() {
  const [preserveFormData, setPreserveFormData] = useState(false);  

  const {
    events,
    addEvent,
    updateEvent,
    removeEvent,
    addProperty,
    updateProperty,
    removeProperty,
    generatedEventCount,
    setGeneratedEventCount,
  } = useEventStore()

  const { mutate: submitEvents, isPending, error, data } = useEventSubmission(preserveFormData)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const isValid = events.every(
      (event) => event.event_name && event.timestamp && event.external_customer_id
    )
    
    if (!isValid) {
      // You might want to add this to your store or handle it differently
      alert("Please fill in all required fields (Event Name, Timestamp, and External Customer ID)")
      return
    }

    submitEvents()
  }

  useEffect(() => {
    // Check each event for animatingSubmission flag
    events.forEach((event, index) => {
      if (event.animatingSubmission) {
        const timer = setTimeout(() => {
          // Clear the animation state after 2 seconds
          updateEvent(index, 'animatingSubmission', false);
        }, 2000);
        
        // Store the timer ID for cleanup
        return () => clearTimeout(timer);
      }
    });
  }, [events, updateEvent]);

  return (
    <div className="container mx-auto px-4 py-8">
      <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl mx-auto">
        {events.map((event, eventIndex) => (
          <div key={event.idempotency_key} className="relative">
            <Card className={`
              ${event.submitted ? 'border-green-500 border-2 rounded-xl border bg-card' : ""}
              ${event.animatingSubmission ? 'animate-flash' : ''}
            `}>
              <CardHeader>
                <CardTitle>Model Your Event</CardTitle>
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
                      const date = new Date(e.target.value)
                      updateEvent(eventIndex, "timestamp", date.toISOString())
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
                    value={event.idempotency_key}
                    disabled
                  />
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-medium leading-none">Properties</h3>
                  <Table>
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
                                placeholder="Key"
                                value={prop.key}
                                onChange={(e) => updateProperty(eventIndex, propIndex, "key", e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                placeholder="Value"
                                value={prop.value}
                                onChange={(e) => updateProperty(eventIndex, propIndex, "value", e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                  <input
                                  type="checkbox"
                                  checked={prop.isLookalike}
                                  disabled={!prop.key}
                                  onChange={(e) => {
                                      const isChecked = e.target.checked;
                                      if (isChecked) {
                                      // When checking the box, initialize with a default type and empty values
                                      updateProperty(eventIndex, propIndex, "isLookalike", true);
                                      updateProperty(eventIndex, propIndex, "lookalikeType", "set");
                                      updateProperty(eventIndex, propIndex, "lookalikeValues", []);
                                      } else {
                                      // When unchecking, clear all lookalike-related fields
                                      updateProperty(eventIndex, propIndex, "isLookalike", false);
                                      updateProperty(eventIndex, propIndex, "lookalikeType", undefined);
                                      updateProperty(eventIndex, propIndex, "lookalikeValues", undefined);
                                      updateProperty(eventIndex, propIndex, "lookalikeRange", undefined);
                                      }
                                  }}
                                  className="h-4 w-4 rounded border-gray-300"
                                  />
                                <Label className={!prop.key ? 'text-muted-foreground/50' : ''}>
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
                          {prop.isLookalike && (
                            <TableRow>
                              <TableCell colSpan={4}>
                                <div className="space-y-2">
                                  <Select
                                      value={prop.lookalikeType || "set"}
                                      onValueChange={(value) => 
                                          updateProperty(eventIndex, propIndex, "lookalikeType", value as "set" | "range")
                                      }
                                      >
                                      <SelectTrigger>
                                          <SelectValue placeholder="Select lookalike type" />
                                      </SelectTrigger>
                                      <SelectContent>
                                          <SelectItem value="set">Set of Values</SelectItem>
                                          <SelectItem value="range">Range of Integers</SelectItem>
                                      </SelectContent>
                                  </Select>
                                  {prop.lookalikeType === "set" && (
                                    <Input
                                      placeholder="Enter values separated by commas (e.g. apple, banana, cherry)"
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
                                  )}

                                  {prop.lookalikeType === "range" && (
                                    <div className="flex space-x-2">
                                      <div className="space-y-1 w-1/2">
                                        <Label>Minimum value</Label>
                                        <Input
                                          type="number"
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
                                      <div className="space-y-1 w-1/2">
                                        <Label>Maximum value</Label>
                                        <Input
                                          type="number"
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
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                  <Button 
                    type="button" 
                    onClick={() => addProperty(eventIndex)} 
                    className="w-full"
                  >
                    Add Property
                  </Button>
                </div>

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
            {(event.submitted || event.animatingSubmission) && (
              <div className={`absolute top-2 right-2 ${event.animatingSubmission ? 'submission-indicator' : ''}`}>
                <Badge variant="success">
                  {event.animatingSubmission ? 'Just Submitted' : 'Submitted'}
                </Badge>
              </div>
            )}
          </div>
        ))}

        <div className="flex justify-between items-center">
          <Button type="button" onClick={addEvent}>
            Add Another Event
          </Button>
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="preserve-data"
                checked={preserveFormData}
                onCheckedChange={(checked) => setPreserveFormData(checked === true)}
              />
              <Label htmlFor="preserve-data" className="text-sm">
                Preserve form data after submission
              </Label>
            </div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </div>

        <Card className="w-full mt-8">
          <CardHeader>
            <CardTitle>Generate Lookalike Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <Label htmlFor="auto-event-count-select">
                Number of lookalike events to generate:
              </Label>
              <Select
                value={String(generatedEventCount)}
                onValueChange={(value) => setGeneratedEventCount(Number(value))}
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
                ? `${generatedEventCount} lookalike event${
                    generatedEventCount > 1 ? "s" : ""
                  } will be generated and included in the submission.`
                : "No lookalike events will be generated."}
            </p>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error instanceof Error ? error.message : 'An error occurred'}</AlertDescription>
          </Alert>
        )}

        {data && (
          <Alert>
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>
              Successfully processed events. Orb API Response: {JSON.stringify(data)}
            </AlertDescription>
          </Alert>
        )}
      </form>
    </div>
  )
}