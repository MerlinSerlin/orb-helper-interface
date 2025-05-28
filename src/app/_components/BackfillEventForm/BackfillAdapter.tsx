'use client'

import { useState, useEffect } from 'react'
import { BackfillEventForm } from './BackfillEventForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useBackfillEventStore } from './store'
import { AlertCircle } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { BackfillConfig, BackfillPropertyValue  } from '@/types/backfill'

import {
  getMinimumBackfillDate,
  getMaximumBackfillDate,
  validateStartDate,
  validateEndDate,
} from '@/lib/utils'

export function BackfillAdapter() {
    // Define what the test response should look like
    type TestResponseType = {
      success: boolean;
      jobId?: string;
      config?: BackfillConfig;
      events?: Array<{
        event_name: string;
        external_customer_id: string;
        timestamp: string;
        properties: Record<string, string | number | string[]>;
      }>;
      message?: string;
    };

  const { event, updateEvent, reset } = useBackfillEventStore()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [eventsPerDayRange, setEventsPerDayRange] = useState<{ min: number; max: number }>({ min: 1, max: 10 })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<{
    startDate?: string;
    endDate?: string;
  }>({})
  const [success, setSuccess] = useState<string | null>(null)
  const [externalCustomerId, setExternalCustomerId] = useState('')
  const [testMode, setTestMode] = useState(false)
  const [testResponse, setTestResponse] = useState<TestResponseType | null>(null)
  const [replaceExistingEvents, setReplaceExistingEvents] = useState(true)
  
  // Get the minimum and maximum allowed dates
  const minDate = getMinimumBackfillDate() as string
  const maxDate = getMaximumBackfillDate() as string

  // Handle start date change
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartDate = e.target.value;
    
    // Check if valid date
    if (!newStartDate) {
      setStartDate('');
      setFieldError(prev => ({ ...prev, startDate: undefined }));
      return;
    }
    
    // Set the value so the user sees their input
    setStartDate(newStartDate);
    
    // Validate the new start date
    const validation = validateStartDate(newStartDate);
    if (!validation.isValid) {
      setFieldError(prev => ({ ...prev, startDate: validation.errorMessage }));
      return;
    }
    
    // Clear any previous errors
    setFieldError(prev => ({ ...prev, startDate: undefined }));
    
    // Update end date if necessary
    if (endDate) {
      const startDateTime = new Date(newStartDate);
      const endDateTime = new Date(endDate);
      
      if (endDateTime < startDateTime) {
        setEndDate(newStartDate);
        // Clear any end date errors since we're setting it to match start date
        setFieldError(prev => ({ ...prev, endDate: undefined }));
      } else {
        // Revalidate end date with the new start date
        const endValidation = validateEndDate(endDate, newStartDate);
        if (!endValidation.isValid) {
          setFieldError(prev => ({ ...prev, endDate: endValidation.errorMessage }));
        } else {
          setFieldError(prev => ({ ...prev, endDate: undefined }));
        }
      }
    }
  };

  // Handle end date change
  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEndDate = e.target.value;
    
    // Check if valid date
    if (!newEndDate) {
      setEndDate('');
      setFieldError(prev => ({ ...prev, endDate: undefined }));
      return;
    }
    
    // Always update the field value (to show invalid input)
    setEndDate(newEndDate);
    
    // Validate the end date
    const validation = validateEndDate(newEndDate, startDate);
    if (!validation.isValid) {
      setFieldError(prev => ({ ...prev, endDate: validation.errorMessage }));
    } else {
      setFieldError(prev => ({ ...prev, endDate: undefined }));
    }
  };

  // Auto-fill event external customer ID when backfill external customer ID changes
  useEffect(() => {
    if (externalCustomerId) {
      updateEvent("external_customer_id", externalCustomerId);
    }
  }, [externalCustomerId, updateEvent]);

  // Reset test response when toggling test mode off
  useEffect(() => {
    if (!testMode) {
      setTestResponse(null);
    }
  }, [testMode]);

  const handleSubmitBackfill = async () => {
    // Clear any previous errors and test response
    setError(null);
    setFieldError({});
    setTestResponse(null);
    
    // Validate all required fields
    if (!startDate || !endDate) {
      setError('Please specify start and end dates for the backfill time range');
      return;
    }
    
    // Check start date and end date validation
    const startValidation = validateStartDate(startDate);
    if (!startValidation.isValid) {
      setFieldError(prev => ({ ...prev, startDate: startValidation.errorMessage }));
      return;
    }
    
    const endValidation = validateEndDate(endDate, startDate);
    if (!endValidation.isValid) {
      setFieldError(prev => ({ ...prev, endDate: endValidation.errorMessage }));
      return;
    }

    // Validate that event has required fields
    if (!event.event_name) {
      setError('Please fill in the Event Name');
      return;
    }

    // If no event external customer ID is set, show error
    if (!event.external_customer_id) {
      setError('Please fill in the External Customer ID');
      return;
    }

    setIsSubmitting(true);
    setSuccess(null);

    try {
      // Format the event properties for the Python script
      const eventProperties: Record<string, BackfillPropertyValue> = {};
      
      // Process each property to properly format for the Python script
      event.properties.forEach(prop => {
        if (!prop.key) return; // Skip properties without keys
        
        if (prop.useUUID) {
          // For UUID generation, we pass the useUUID flag to the Python script
          eventProperties[prop.key] = {
            useUUID: true
          };
        } else if (prop.isLookalike) {
          if (prop.lookalikeType === 'set' && prop.lookalikeValues && prop.lookalikeValues.length > 0) {
            // For set type, we pass the array of values for random.choice()
            eventProperties[prop.key] = {
              type: 'set',
              values: prop.lookalikeValues
            };
          } else if (prop.lookalikeType === 'range' && prop.lookalikeRange) {
            // For range type, we pass min and max for random.randint()
            eventProperties[prop.key] = {
              type: 'range',
              min: prop.lookalikeRange.min,
              max: prop.lookalikeRange.max
            };
          }
        } else {
          // For fixed values, we just pass the string value
          eventProperties[prop.key] = prop.value;
        }
      });

      // Create the configuration for the Python script
      const backfillConfig = {
        event_name: event.event_name,
        external_customer_id: event.external_customer_id,
        start_date: startDate, // Just use the date string directly
        end_date: endDate, // Just use the date string directly
        events_per_day: { type: 'range', min: eventsPerDayRange.min, max: eventsPerDayRange.max },
        properties: eventProperties,
        backfill_customer_id: externalCustomerId || null,
        test_mode: testMode, // Add test mode flag
        replace_existing_events: replaceExistingEvents // Add the replace existing events flag
      };

      // Send to API route
      const response = await fetch('/api/backfill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backfillConfig),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start backfill');
      }

      const result = await response.json();
      
      if (testMode) {
        // In test mode, show the validated config
        setTestResponse(result);
        setSuccess('Validation successful. See the validated configuration below.');
      } else {
        // In normal mode, show success message and reset form
        setSuccess(`Backfill job submitted successfully with ID: ${result.jobId}`);
        reset(); // Reset the form after successful submission
        setExternalCustomerId(''); // Reset the backfill external customer ID
        setStartDate('');
        setEndDate('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while submitting the backfill job');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Backfill Date Range</CardTitle>
          <CardDescription>
            Specify the date range for the backfill. Events will be generated with timestamps at noon on each day in this range.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6">
            {/* Date range row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Start Date Column */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Label htmlFor="startDate" className="text-sm font-medium">
                    Start Date *
                  </Label>
                  <div className="flex items-center text-amber-500 text-xs">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Max 90 days in the past
                  </div>
                </div>
                
                <Input 
                  id="startDate"
                  type="date" // Changed from datetime-local to date
                  value={startDate}
                  onChange={handleStartDateChange}
                  min={minDate}
                  max={maxDate}
                  className={`w-full ${fieldError.startDate ? "border-red-500" : ""}`}
                  required 
                />
                
                <div className="h-5 mt-1">
                  {fieldError.startDate ? (
                    <p className="text-sm text-red-500">{fieldError.startDate}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      The start date cannot be more than 90 days in the past or in the future.
                    </p>
                  )}
                </div>
              </div>
              
              {/* End Date Column */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Label htmlFor="endDate" className="text-sm font-medium">
                    End Date *
                  </Label>
                </div>
                
                <Input 
                  id="endDate"
                  type="date" // Changed from datetime-local to date
                  value={endDate}
                  onChange={handleEndDateChange}
                  max={maxDate}
                  className={`w-full ${fieldError.endDate ? "border-red-500" : ""}`}
                  required 
                  disabled={!startDate} // Disable until start date is set
                />
                
                <div className="h-5 mt-1">
                  {fieldError.endDate ? (
                    <p className="text-sm text-red-500">{fieldError.endDate}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      The end date must be after the start date and cannot be in the future.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Backfill Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="external-customer-id" className="text-sm font-medium mb-2 block">
              External Customer ID
            </Label>
            <Input
              id="external-customer-id"
              value={externalCustomerId}
              onChange={(e) => setExternalCustomerId(e.target.value)}
              placeholder="acme"
              className="w-full"
            />
            <p className="text-sm text-muted-foreground mt-1">
              The external customer ID of the customer to which this backfill is scoped. Omitting this field will scope the backfill to all customers.
              When specified, this value will be used for all events and cannot be overridden.
            </p>
          </div>
          <div>
          <div>
            <div className="mb-4">
              <Label htmlFor="events-per-day-range" className="text-sm font-medium">
                Events Per Day Range
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Configure how many events will be generated each day in the date range.
              </p>
            </div>
            
            <div className="space-y-4">
              {/* Labels row with warnings on same line */}
              <div className="flex space-x-2">
                <div className="w-1/2">
                  <Label htmlFor="events-min" className="text-sm font-medium">
                    Minimum events
                  </Label>
                </div>
                <div className="w-1/2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="events-max" className="text-sm font-medium">
                      Maximum events
                    </Label>
                    <div className="flex items-center text-amber-500 text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Max 10 events per day
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Input fields row */}
              <div className="flex space-x-2">
                <div className="w-1/2">
                  <Input
                    id="events-min"
                    type="number"
                    min={1}
                    max={10}
                    value={eventsPerDayRange.min}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (isNaN(value)) {
                        setEventsPerDayRange(prev => ({ ...prev, min: 1 }));
                      } else if (value < 1) {
                        setEventsPerDayRange(prev => ({ ...prev, min: 1 }));
                      } else if (value > 10) {
                        setEventsPerDayRange(prev => ({ ...prev, min: 10 }));
                      } else if (value > eventsPerDayRange.max) {
                        // If min is greater than max, set min equal to max
                        setEventsPerDayRange(prev => ({ ...prev, min: prev.max }));
                      } else {
                        setEventsPerDayRange(prev => ({ ...prev, min: value }));
                      }
                    }}
                  />
                </div>
                <div className="w-1/2">
                  <Input
                    id="events-max"
                    type="number"
                    min={1}
                    max={10}
                    value={eventsPerDayRange.max}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (isNaN(value)) {
                        setEventsPerDayRange(prev => ({ ...prev, max: 10 }));
                      } else if (value < eventsPerDayRange.min) {
                        // If max is less than min, set max equal to min
                        setEventsPerDayRange(prev => ({ ...prev, max: prev.min }));
                      } else if (value > 10) {
                        setEventsPerDayRange(prev => ({ ...prev, max: 10 }));
                      } else {
                        setEventsPerDayRange(prev => ({ ...prev, max: value }));
                      }
                    }}
                  />
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">
                The script will generate a random number of events between min and max for each day in the date range.
              </p>
            </div>
          </div>
          </div>
          
          {/* Replace Existing Events Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="replace-existing-events" 
              checked={replaceExistingEvents} 
              onCheckedChange={(checked) => setReplaceExistingEvents(checked === true)}
            />
            <Label htmlFor="replace-existing-events" className="text-sm font-medium">
              Replace Existing Events
            </Label>
            <span className="text-sm text-muted-foreground">
              (If unchecked, events will be added without replacing existing ones in the date range)
            </span>
          </div>
          
          {/* Test Mode Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="test-mode" 
              checked={testMode} 
              onCheckedChange={(checked) => setTestMode(checked === true)}
            />
            <Label htmlFor="test-mode" className="text-sm font-medium">
              Test Mode
            </Label>
            <span className="text-sm text-muted-foreground">
              (Validate without executing the backfill)
            </span>
          </div>
        </CardContent>
      </Card>
      
      {/* Pass externalCustomerId to BackfillEventForm to conditionally disable the event customer ID field */}
      <BackfillEventForm backfillCustomerId={externalCustomerId} />
      
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-end">
            <Button 
              onClick={handleSubmitBackfill} 
              disabled={isSubmitting || !!fieldError.startDate || !!fieldError.endDate}
              className="w-full md:w-auto"
            >
              {isSubmitting 
                ? 'Submitting...' 
                : testMode 
                  ? 'Validate Configuration' 
                  : 'Submit Backfill Job'
              }
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mt-6">
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
      
      {/* Display test response */}
      {testResponse && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Validation Results</CardTitle>
            <CardDescription>
              The configuration has been validated but no backfill job was executed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-100 p-4 rounded-md">
              <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(testResponse, null, 2)}</pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}