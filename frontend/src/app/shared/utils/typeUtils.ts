


export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}


export function isNonEmptyArrayStrict<T>(value: unknown): value is [T, ...T[]] {
  return Array.isArray(value) && value.length > 0;
}


export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}


export function isString(value: unknown): value is string {
  return typeof value === 'string';
}


export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}


export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}


export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}


export function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}


export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}


export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}


export function isEmptyArray<T>(value: T[]): boolean {
  return !Array.isArray(value) || value.length === 0;
}


export function hasLength<T>(value: T[], length: number): boolean {
  return Array.isArray(value) && value.length === length;
}


export function hasMinLength<T>(value: T[], minLength: number): boolean {
  return Array.isArray(value) && value.length >= minLength;
}


export function hasMaxLength<T>(value: T[], maxLength: number): boolean {
  return Array.isArray(value) && value.length <= maxLength;
}


export function hasKey<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return isObject(obj) && key in obj;
}


export function hasKeys<K extends string>(
  obj: unknown,
  keys: K[]
): obj is Record<K, unknown> {
  if (!isObject(obj)) return false;
  return keys.every(key => key in obj);
}


export function isOneOf<T extends readonly unknown[]>(
  value: unknown,
  validValues: T
): value is T[number] {
  return validValues.includes(value as T[number]);
}


export function isArrayOf<T>(
  value: unknown,
  typeGuard: (item: unknown) => item is T
): value is T[] {
  return Array.isArray(value) && value.every(typeGuard);
}


export function isValidId(value: unknown): value is string {
  return isNonEmptyString(value);
}


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
  // Simple email validation regex - not vulnerable to ReDoS
  // eslint-disable-next-line sonarjs/slow-regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}


export function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0;
}


export function isNonNegativeNumber(value: unknown): value is number {
  return isNumber(value) && value >= 0;
}


export function isInteger(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value);
}


export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}


export function isISODateString(value: unknown): value is string {
  if (!isString(value)) return false;
  const date = new Date(value);
  return isValidDate(date) && date.toISOString() === value;
}


export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
  return value instanceof Promise;
}


export function isError(value: unknown): value is Error {
  return value instanceof Error;
}


export function safeString(value: unknown, defaultValue: string = ''): string {
  return isString(value) ? value : defaultValue;
}


export function safeNumber(value: unknown, defaultValue: number = 0): number {
  if (isNumber(value)) return value;
  if (isString(value)) {
    const parsed = Number(value);
    return isNumber(parsed) ? parsed : defaultValue;
  }
  return defaultValue;
}


export function safeArray<T>(value: unknown, defaultValue: T[] = []): T[] {
  return isArray<T>(value) ? value : defaultValue;
}