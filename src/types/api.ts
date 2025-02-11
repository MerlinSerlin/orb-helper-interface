export type OrbResponse = {
    status: string;
    message: string;
    // Add other fields that come back from Orb
  }
  
  export type ApiResponse = {
    count: number;
    orbResponse: OrbResponse;
  }