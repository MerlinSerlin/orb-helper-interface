import { Suspense } from 'react'
import { MainLayout } from '@/components/layout/MainLayout'
import { BackfillManager } from '../_components/BackfillManager'
import { Card, CardContent } from '@/components/ui/card'

export default function BackfillPage() {
  return (
    <MainLayout>
      <main className="container mx-auto py-6 px-4">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">Backfill Manager</h1>
            <p className="text-muted-foreground">
              Schedule and monitor historical data backfills to Orb's API.
            </p>
          </div>
          <Suspense 
            fallback={
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-center min-h-[400px]">
                    <p className="text-muted-foreground">Loading backfill manager...</p>
                  </div>
                </CardContent>
              </Card>
            }
          >
            <BackfillManager />
          </Suspense>
        </div>
      </main>
    </MainLayout>
  )
}

// Add metadata
export const metadata = {
  title: 'Backfill Manager - Orb Helper',
  description: 'Schedule and monitor historical data backfills to Orb&apos;s API.'
}