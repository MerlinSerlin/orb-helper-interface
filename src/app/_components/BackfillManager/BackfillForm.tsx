// src/app/_components/BackfillManager/BackfillForm.tsx
'use client'

import { useState } from 'react'
import { useBackfillStore } from './store'
import { submitBackfillJob } from '@/app/actions/backfill'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { 
  Alert, 
  AlertDescription, 
  AlertTitle 
} from '@/components/ui/alert'

export function BackfillForm() {
  const { addJob } = useBackfillStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const form = e.currentTarget
      const formData = new FormData(form)

      const name = formData.get('name') as string
      const description = formData.get('description') as string
      const eventType = formData.get('eventType') as string
      const startDate = formData.get('startDate') as string
      const endDate = formData.get('endDate') as string

      // Add the file to FormData if one was selected
      if (selectedFile) {
        formData.set('file', selectedFile)
      }

      // Submit to the server action
      const result = await submitBackfillJob(formData)

      if (!result.success) {
        throw new Error(result.message)
      }

      // Add to the local store
      const jobId = addJob({
        name,
        description,
        eventType,
        startDate,
        endDate,
        fileName: selectedFile?.name,
      })

      setSuccess('Backfill job submitted successfully')
      form.reset()
      setSelectedFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while submitting the job')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setSelectedFile(file)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Backfill Job</CardTitle>
        <CardDescription>
          Create a new backfill job to process historical data
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Job Name *</Label>
            <Input id="name" name="name" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea 
              id="description" 
              name="description" 
              placeholder="Optional description of this backfill job"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="eventType">Event Type *</Label>
            <Input 
              id="eventType" 
              name="eventType" 
              placeholder="e.g., page_view, purchase" 
              required 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input 
                id="startDate" 
                name="startDate" 
                type="datetime-local" 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date *</Label>
              <Input 
                id="endDate" 
                name="endDate" 
                type="datetime-local" 
                required 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Data File (CSV)</Label>
            <Input 
              id="file" 
              name="file" 
              type="file" 
              accept=".csv" 
              onChange={handleFileChange}
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Selected file: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
              </p>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Backfill Job'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}