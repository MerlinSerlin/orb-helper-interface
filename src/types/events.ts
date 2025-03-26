export type LookalikeRange = {
    min: number;
    max: number;
  };
  
  export type Property = {
    key: string;
    value: string;
    isLookalike: boolean;
    lookalikeType?: "set" | "range";
    lookalikeValues?: string[];
    lookalikeRange?: LookalikeRange;
    [key: string]: string | boolean | string[] | LookalikeRange | undefined;
  };
  
  export type Event = {
    event_name: string;
    timestamp: string;
    properties: Property[];
    idempotency_key: string;
    external_customer_id: string;
    submitted?: boolean;
    animatingSubmission?: boolean;
    lastSubmittedAt?: string;
    lastSubmittedIdempotencyKey?: string;
  };

  export interface EventSubmissionResponse {
    success: boolean;
    message?: string;
    data?: Record<string, unknown>;
  }