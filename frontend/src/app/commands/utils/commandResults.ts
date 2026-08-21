import type { CommandResult } from '../system/types';

export const success = (message?: string, data?: unknown): CommandResult => ({
  success: true,
  ...(message !== undefined ? { message } : {}),
  ...(data !== undefined ? { data } : {})
});

export const failure = (error: string, data?: unknown): CommandResult => ({
  success: false,
  error,
  ...(data !== undefined ? { data } : {})
});
