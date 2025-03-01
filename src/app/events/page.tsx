import { Suspense } from 'react'
import { MainLayout } from '@/components/layout/MainLayout'
import { EventForm } from '@/app/_components/EventForm'
import { Card, CardContent } from '@/components/ui/card'

export default function EventsPage() {
  return (
    <MainLayout>
      <main className="container mx-auto py-6 px-4">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">Event Generator</h1>
            <p className="text-muted-foreground">
              Create and manage event data with customizable properties and lookalike generation.
            </p>
          </div>

          <Suspense 
            fallback={
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-center min-h-[400px]">
                    <p className="text-muted-foreground">Loading event form...</p>
                  </div>
                </CardContent>
              </Card>
            }
          >
            <EventForm />
          </Suspense>
        </div>
      </main>
    </MainLayout>
  )
}

// Add metadata
export const metadata = {
  title: 'Event Generator - Orb Helper',
  description: 'Create and manage event data with customizable properties and lookalike generation.'
}