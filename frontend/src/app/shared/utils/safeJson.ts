

export interface JsonParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}


export function safeJsonParse<T = any>(jsonString: string): JsonParseResult<T> {
  try {
    const data = JSON.parse(jsonString) as T;
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'JSON parsing failed'
    };
  }
}


export function safeJsonParseWithDefault<T>(jsonString: string, defaultValue: T): T {
  const result = safeJsonParse<T>(jsonString);
  return result.success ? result.data! : defaultValue;
}


export function safeJsonStringify(value: any, space?: number): JsonParseResult<string> {
  try {
    const data = JSON.stringify(value, null, space);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'JSON stringification failed'
    };
  }
}


export function parseStoredJson<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return defaultValue;
    return safeJsonParseWithDefault(stored, defaultValue);
  } catch {
    return defaultValue;
  }
}


export function storeJson(key: string, value: any): boolean {
  try {
    const result = safeJsonStringify(value);
    if (result.success) {
      localStorage.setItem(key, result.data!);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}