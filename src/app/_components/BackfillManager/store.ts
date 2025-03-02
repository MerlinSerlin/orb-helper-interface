'use client'

import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { BackfillJob, BackfillStatus } from '@/types/backfill'

interface BackfillState {
  jobs: BackfillJob[]
  isLoading: boolean
  error: string | null
}

interface BackfillActions {
  addJob: (job: Omit<BackfillJob, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => string
  updateJob: (id: string, updates: Partial<BackfillJob>) => void
  removeJob: (id: string) => void
  updateJobStatus: (id: string, status: BackfillStatus, error?: string) => void
  updateJobProgress: (id: string, processedEvents: number, totalEvents: number) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
}

type BackfillStore = BackfillState & BackfillActions

export const useBackfillStore = create<BackfillStore>((set, get) => ({
  jobs: [],
  isLoading: false,
  error: null,

  addJob: (jobData) => {
    const now = new Date().toISOString()
    const id = uuidv4()
    
    set((state) => ({
      jobs: [
        ...state.jobs,
        {
          id,
          ...jobData,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        }
      ]
    }))
    
    return id
  },

  updateJob: (id, updates) => {
    set((state) => ({
      jobs: state.jobs.map((job) => 
        job.id === id 
          ? { ...job, ...updates, updatedAt: new Date().toISOString() } 
          : job
      )
    }))
  },

  removeJob: (id) => {
    set((state) => ({
      jobs: state.jobs.filter((job) => job.id !== id)
    }))
  },

  updateJobStatus: (id, status, error) => {
    set((state) => ({
      jobs: state.jobs.map((job) => 
        job.id === id 
          ? { 
              ...job, 
              status, 
              error, 
              updatedAt: new Date().toISOString() 
            } 
          : job
      )
    }))
  },

  updateJobProgress: (id, processedEvents, totalEvents) => {
    const progress = totalEvents > 0 ? Math.floor((processedEvents / totalEvents) * 100) : 0
    
    set((state) => ({
      jobs: state.jobs.map((job) => 
        job.id === id 
          ? { 
              ...job, 
              progress, 
              processedEvents, 
              totalEvents, 
              updatedAt: new Date().toISOString() 
            } 
          : job
      )
    }))
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error })
}))