

declare global {
  interface Window {
    MindFlowOllamaBridge?: {
      version: string;
      available: boolean;
      
      
      request(url: string, options: RequestInit): Promise<{
        success: boolean;
        data?: any;
        error?: string;
        status?: number;
      }>;
      
      
      testConnection(baseUrl: string): Promise<{
        success: boolean;
        error?: string;
        message?: string;
      }>;
      
      
      getModels(baseUrl: string): Promise<string[]>;
    };
  }
}

export {};