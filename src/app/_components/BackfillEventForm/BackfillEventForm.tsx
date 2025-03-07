// app/_components/BackfillEventForm/BackfillEventForm.tsx
'use client'

import { Fragment } from 'react'
import { useBackfillEventStore } from './store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle } from 'lucide-react'

interface BackfillEventFormProps {
  backfillCustomerId?: string;
}

export function BackfillEventForm({ backfillCustomerId = '' }: BackfillEventFormProps) {
  const {
    event,
    updateEvent,
    addProperty,
    updateProperty,
    removeProperty,
  } = useBackfillEventStore()

  // Check if the customer ID field should be disabled
  const isCustomerIdDisabled = !!backfillCustomerId;

  // Handle comma-separated values with proper backspace support
  const handleLookalikeValuesChange = (propIndex: number, value: string) => {
    // Split by commas, but keep empty values
    const valueArray = value.split(',').map(v => v.trim());
    updateProperty(propIndex, "lookalikeValues", valueArray);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Model Your Event</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="event-name">Event Name *</Label>
          <Input
            id="event-name"
            value={event.event_name}
            onChange={(e) => updateEvent("event_name", e.target.value)}
            placeholder="api_request"
            required
          />
          <p className="text-sm text-muted-foreground">
            This will be the event_name passed to the Orb API.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Label htmlFor="event-external-customer-id">External Customer ID *</Label>
            {isCustomerIdDisabled && (
              <div className="flex items-center text-amber-500 text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                Set by backfill configuration
              </div>
            )}
          </div>
          <Input
            id="event-external-customer-id"
            value={event.external_customer_id}
            onChange={(e) => !isCustomerIdDisabled && updateEvent("external_customer_id", e.target.value)}
            placeholder="acme"
            required
            disabled={isCustomerIdDisabled}
            className={isCustomerIdDisabled ? "bg-slate-100" : ""}
          />
          {isCustomerIdDisabled ? (
            <p className="text-sm text-amber-600">
              This field is automatically populated from the Backfill Configuration and cannot be edited. To use a different External Customer ID, clear the field in the Backfill Configuration section.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Customer ID to associate with this specific event.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium leading-none">Properties</h3>
          <p className="text-sm text-muted-foreground mb-2">
            Define properties for your event. You can create fixed values or randomized values.
          </p>
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
                <Fragment key={propIndex}>
                  <TableRow>
                    <TableCell>
                      <Input
                        placeholder="Key"
                        value={prop.key}
                        onChange={(e) => updateProperty(propIndex, "key", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Value"
                        value={prop.value}
                        onChange={(e) => updateProperty(propIndex, "value", e.target.value)}
                        disabled={prop.isLookalike}
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
                              updateProperty(propIndex, "isLookalike", true);
                              updateProperty(propIndex, "lookalikeType", "set");
                              updateProperty(propIndex, "lookalikeValues", []);
                            } else {
                              // When unchecking, clear all lookalike-related fields
                              updateProperty(propIndex, "isLookalike", false);
                              updateProperty(propIndex, "lookalikeType", undefined);
                              updateProperty(propIndex, "lookalikeValues", undefined);
                              updateProperty(propIndex, "lookalikeRange", undefined);
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label className={!prop.key ? 'text-muted-foreground/50' : ''}>
                          Randomize values
                        </Label>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => removeProperty(propIndex)}
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
                              updateProperty(propIndex, "lookalikeType", value as "set" | "range")
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select randomization type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="set">Set of Values</SelectItem>
                              <SelectItem value="range">Range of Integers</SelectItem>
                            </SelectContent>
                          </Select>
                          {prop.lookalikeType === "set" && (
                            <div className="space-y-1">
                              {/* <Label>Enter possible values separated by commas</Label> */}
                              <Input
                                placeholder="Enter values separated by commas (e.g. apple, banana, cherry)"
                                value={prop.lookalikeValues?.join(", ") || ""}
                                onChange={(e) => 
                                  handleLookalikeValuesChange(propIndex, e.target.value)
                                }
                              />
                              <p className="text-xs text-muted-foreground">
                                The script will randomly choose one of these values for each event
                              </p>
                            </div>
                          )}

                          {prop.lookalikeType === "range" && (
                            <div className="space-y-1">
                              <div className="flex space-x-2">
                                <div className="space-y-1 w-1/2">
                                  <Label>Minimum value</Label>
                                  <Input
                                    type="number"
                                    placeholder="Min"
                                    value={prop.lookalikeRange?.min || ""}
                                    onChange={(e) =>
                                      updateProperty(propIndex, "lookalikeRange", {
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
                                      updateProperty(propIndex, "lookalikeRange", {
                                        min: prop.lookalikeRange?.min ?? 0,
                                        max: Number(e.target.value),
                                      })
                                    }
                                  />
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                The script will generate a random number between min and max for each event
                              </p>
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
            onClick={() => addProperty()} 
            className="w-full"
          >
            Add Property
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}