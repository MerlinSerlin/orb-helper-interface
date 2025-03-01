// src/app/_components/BackfillManager/BackfillList.tsx
'use client'

import { useBackfillStore } from './store'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'
import { BackfillStatus } from '@/types/backfill'

export function BackfillList() {
  const { jobs, removeJob } = useBackfillStore()

  // Sort jobs by date (newest first)
  const sortedJobs = [...jobs].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const getStatusColor = (status: BackfillStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'processing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    }
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Backfill Jobs</CardTitle>
          <CardDescription>
            You haven't created any backfill jobs yet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Use the form above to create a new backfill job.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backfill Jobs</CardTitle>
        <CardDescription>
          Your recent backfill jobs and their status
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Event Type</TableHead>
              <TableHead>Date Range</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedJobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">
                  {job.name}
                  {job.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {job.description}
                    </p>
                  )}
                </TableCell>
                <TableCell>{job.eventType}</TableCell>
                <TableCell>
                  {job.startDate && job.endDate ? (
                    <span className="whitespace-nowrap">
                      {new Date(job.startDate).toLocaleDateString()} - {new Date(job.endDate).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Not specified</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge className={getStatusColor(job.status)} variant="outline">
                    {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                  </Badge>
                  {job.progress !== undefined && job.status === 'processing' && (
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2 dark:bg-gray-700">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full dark:bg-blue-500"
                        style={{ width: `${job.progress}%` }}
                      ></div>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeJob(job.id)}
                  >
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}