import { MainLayout } from '@/components/layout/MainLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  return (
    <MainLayout>
      <div className="container mx-auto py-6 px-4">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to the Orb Helper Interface. Select a tool to get started.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Event Generator</CardTitle>
                <CardDescription>
                  Create and send events to Orb's ingestion API
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-4">
                  Generate and submit events to Orb with custom properties and lookalike generation.
                </p>
                <Link href="/events">
                  <Button>Go to Event Generator</Button>
                </Link>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Backfill Manager</CardTitle>
                <CardDescription>
                  Schedule and monitor historical data backfills
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-4">
                  Upload historical data for backfilling into Orb's system.
                </p>
                <Link href="/backfill">
                  <Button>Go to Backfill Manager</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}