export type BackfillStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type BackfillJob = {
  id: string;
  name: string;
  description?: string;
  fileUrl?: string;
  fileName?: string;
  status: BackfillStatus;
  startDate?: string;
  endDate?: string;
  eventType?: string;
  createdAt: string;
  updatedAt: string;
  progress?: number;
  error?: string;
  totalEvents?: number;
  processedEvents?: number;
};

export type BackfillFormData = {
  name: string;
  description?: string;
  eventType: string;
  startDate: string;
  endDate: string;
  file?: File;
};