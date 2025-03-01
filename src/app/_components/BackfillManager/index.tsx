'use client'

import { BackfillForm } from './BackfillForm'
import { BackfillList } from './BackfillList'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function BackfillManager() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="form">
        <TabsList>
          <TabsTrigger value="form">Create Backfill</TabsTrigger>
          <TabsTrigger value="jobs">View Jobs</TabsTrigger>
        </TabsList>
        <TabsContent value="form" className="mt-4">
          <BackfillForm />
        </TabsContent>
        <TabsContent value="jobs" className="mt-4">
          <BackfillList />
        </TabsContent>
      </Tabs>
    </div>
  )
}