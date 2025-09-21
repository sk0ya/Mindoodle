/**
 * 型ガードとバリデーション用のユーティリティ関数
 * 共通的な型チェックパターンを提供
 */

/**
 * 文字列型かつ空でないことをチェック
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * 配列型かつ空でないことをチェック（typeGuardバージョン）
 */
export function isNonEmptyArrayStrict<T>(value: unknown): value is [T, ...T[]] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * 配列型であることをチェック
 */
export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * 文字列型であることをチェック
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * 数値型であることをチェック
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * ブール型であることをチェック
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * オブジェクト型であることをチェック（nullを除く）
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 関数型であることをチェック
 */
export function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}

/**
 * null または undefined かどうかをチェック
 */
export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * 定義されていることをチェック
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * 空配列かどうかをチェック（typeUtils版）
 */
export function isEmptyArray<T>(value: T[]): boolean {
  return !Array.isArray(value) || value.length === 0;
}

/**
 * 配列が指定した長さを持つかチェック
 */
export function hasLength<T>(value: T[], length: number): boolean {
  return Array.isArray(value) && value.length === length;
}

/**
 * 配列が最小長を満たすかチェック
 */
export function hasMinLength<T>(value: T[], minLength: number): boolean {
  return Array.isArray(value) && value.length >= minLength;
}

/**
 * 配列が最大長を超えないかチェック
 */
export function hasMaxLength<T>(value: T[], maxLength: number): boolean {
  return Array.isArray(value) && value.length <= maxLength;
}

/**
 * オブジェクトが指定されたキーを持つかチェック
 */
export function hasKey<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return isObject(obj) && key in obj;
}

/**
 * オブジェクトが指定されたキーを全て持つかチェック
 */
export function hasKeys<K extends string>(
  obj: unknown,
  keys: K[]
): obj is Record<K, unknown> {
  if (!isObject(obj)) return false;
  return keys.every(key => key in obj);
}

/**
 * 値が指定された型のいずれかに一致するかチェック
 */
export function isOneOf<T extends readonly unknown[]>(
  value: unknown,
  validValues: T
): value is T[number] {
  return validValues.includes(value as T[number]);
}

/**
 * 配列の全ての要素が指定された型ガードを満たすかチェック
 */
export function isArrayOf<T>(
  value: unknown,
  typeGuard: (item: unknown) => item is T
): value is T[] {
  return Array.isArray(value) && value.every(typeGuard);
}

/**
 * ID形式の文字列かどうかをチェック（空でない文字列）
 */
export function isValidId(value: unknown): value is string {
  return isNonEmptyString(value);
}

/**
 * URL形式の文字列かどうかをチェック（typeUtils版）
 */
export function isValidUrlString(value: unknown): value is string {
  if (!isString(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Email形式の文字列かどうかをチェック
 */
export function isValidEmail(value: unknown): value is string {
  if (!isString(value)) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * 正の数かどうかをチェック
 */
export function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0;
}

/**
 * 非負数かどうかをチェック
 */
export function isNonNegativeNumber(value: unknown): value is number {
  return isNumber(value) && value >= 0;
}

/**
 * 整数かどうかをチェック
 */
export function isInteger(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value);
}

/**
 * 日付オブジェクトかどうかをチェック
 */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

/**
 * ISO日付文字列かどうかをチェック
 */
export function isISODateString(value: unknown): value is string {
  if (!isString(value)) return false;
  const date = new Date(value);
  return isValidDate(date) && date.toISOString() === value;
}

/**
 * Promise型かどうかをチェック
 */
export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
  return value instanceof Promise;
}

/**
 * Error型かどうかをチェック
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * 安全な型変換 - 文字列への変換
 */
export function safeString(value: unknown, defaultValue: string = ''): string {
  return isString(value) ? value : defaultValue;
}

/**
 * 安全な型変換 - 数値への変換
 */
export function safeNumber(value: unknown, defaultValue: number = 0): number {
  if (isNumber(value)) return value;
  if (isString(value)) {
    const parsed = Number(value);
    return isNumber(parsed) ? parsed : defaultValue;
  }
  return defaultValue;
}

/**
 * 安全な型変換 - 配列への変換
 */
export function safeArray<T>(value: unknown, defaultValue: T[] = []): T[] {
  return isArray<T>(value) ? value : defaultValue;
}