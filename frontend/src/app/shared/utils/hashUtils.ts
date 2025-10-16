/**
 * Generate a simple hash from a string using djb2 algorithm
 * This is used for clipboard content verification
 */
export function generateSimpleHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i); // hash * 33 + c
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate hash from a JSON-serializable object
 */
export function generateObjectHash<T>(obj: T): string {
  const jsonString = JSON.stringify(obj);
  return generateSimpleHash(jsonString);
}
