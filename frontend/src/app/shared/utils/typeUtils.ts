// Type guards
export const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
export const isNonEmptyArrayStrict = <T>(value: unknown): value is [T, ...T[]] => Array.isArray(value) && value.length > 0;
export const isArray = <T>(value: unknown): value is T[] => Array.isArray(value);
export const isString = (value: unknown): value is string => typeof value === 'string';
export const isNumber = (value: unknown): value is number => typeof value === 'number' && !isNaN(value);
export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
export const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export const isFunction = (value: unknown): value is Function => typeof value === 'function';
export const isNullish = (value: unknown): value is null | undefined => value === null || value === undefined;
export const isDefined = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined;

// Array validators
export const isEmptyArray = <T>(value: T[]): boolean => !Array.isArray(value) || value.length === 0;
export const hasLength = <T>(value: T[], length: number): boolean => Array.isArray(value) && value.length === length;
export const hasMinLength = <T>(value: T[], minLength: number): boolean => Array.isArray(value) && value.length >= minLength;
export const hasMaxLength = <T>(value: T[], maxLength: number): boolean => Array.isArray(value) && value.length <= maxLength;

// Object validators
export const hasKey = <K extends string>(obj: unknown, key: K): obj is Record<K, unknown> => isObject(obj) && key in obj;
export const hasKeys = <K extends string>(obj: unknown, keys: K[]): obj is Record<K, unknown> => isObject(obj) && keys.every(key => key in obj);

// Value validators
export const isOneOf = <T extends readonly unknown[]>(value: unknown, validValues: T): value is T[number] => validValues.includes(value as T[number]);
export const isArrayOf = <T>(value: unknown, typeGuard: (item: unknown) => item is T): value is T[] => Array.isArray(value) && value.every(typeGuard);
export const isValidId = (value: unknown): value is string => isNonEmptyString(value);

export function isValidUrlString(value: unknown): value is string {
  if (!isString(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function isValidEmail(value: unknown): value is string {
  if (!isString(value)) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

// Number validators
export const isPositiveNumber = (value: unknown): value is number => isNumber(value) && value > 0;
export const isNonNegativeNumber = (value: unknown): value is number => isNumber(value) && value >= 0;
export const isInteger = (value: unknown): value is number => isNumber(value) && Number.isInteger(value);

// Date validators
export const isValidDate = (value: unknown): value is Date => value instanceof Date && !isNaN(value.getTime());
export const isISODateString = (value: unknown): value is string => isString(value) && isValidDate(new Date(value)) && new Date(value).toISOString() === value;

// Other type guards
export const isPromise = <T = unknown>(value: unknown): value is Promise<T> => value instanceof Promise;
export const isError = (value: unknown): value is Error => value instanceof Error;

// Safe converters
export const safeString = (value: unknown, defaultValue: string = ''): string => isString(value) ? value : defaultValue;

export function safeNumber(value: unknown, defaultValue: number = 0): number {
  if (isNumber(value)) return value;
  if (isString(value)) {
    const parsed = Number(value);
    return isNumber(parsed) ? parsed : defaultValue;
  }
  return defaultValue;
}

export const safeArray = <T>(value: unknown, defaultValue: T[] = []): T[] => isArray<T>(value) ? value : defaultValue;
