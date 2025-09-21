/**
 * 配列操作用のユーティリティ関数
 * 共通的な配列処理パターンを提供
 */

/**
 * 型安全なfind操作
 */
export function safeFindById<T extends { id: string }>(
  array: T[],
  id: string
): T | undefined {
  return array.find(item => item.id === id);
}

/**
 * プロパティ値でアイテムを検索
 */
export function findByProperty<T, K extends keyof T>(
  array: T[],
  key: K,
  value: T[K]
): T | undefined {
  return array.find(item => item[key] === value);
}

/**
 * 複数の条件でアイテムを検索
 */
export function findByConditions<T>(
  array: T[],
  conditions: Partial<T>
): T | undefined {
  return array.find(item => {
    return Object.entries(conditions).every(([key, value]) => {
      return item[key as keyof T] === value;
    });
  });
}

/**
 * 型安全なfilter操作（IDベース）
 */
export function filterById<T extends { id: string }>(
  array: T[],
  idsToKeep: string[]
): T[] {
  return array.filter(item => idsToKeep.includes(item.id));
}

/**
 * IDで除外するfilter操作
 */
export function filterExcludeById<T extends { id: string }>(
  array: T[],
  idsToExclude: string[]
): T[] {
  return array.filter(item => !idsToExclude.includes(item.id));
}

/**
 * プロパティ値でフィルタリング
 */
export function filterByProperty<T, K extends keyof T>(
  array: T[],
  key: K,
  value: T[K]
): T[] {
  return array.filter(item => item[key] === value);
}

/**
 * 複数の条件でフィルタリング
 */
export function filterByConditions<T>(
  array: T[],
  conditions: Partial<T>
): T[] {
  return array.filter(item => {
    return Object.entries(conditions).every(([key, value]) => {
      return item[key as keyof T] === value;
    });
  });
}

/**
 * 配列から重複を除去（IDベース）
 */
export function uniqueById<T extends { id: string }>(array: T[]): T[] {
  const seen = new Set<string>();
  return array.filter(item => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

/**
 * プロパティ値で重複除去
 */
export function uniqueByProperty<T, K extends keyof T>(
  array: T[],
  key: K
): T[] {
  const seen = new Set<T[K]>();
  return array.filter(item => {
    const value = item[key];
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

/**
 * 配列を指定したプロパティでソート
 */
export function sortByProperty<T, K extends keyof T>(
  array: T[],
  key: K,
  direction: 'asc' | 'desc' = 'asc'
): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];

    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * 配列を分割（chunk）
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * 配列のインデックスベースでアイテムを移動
 */
export function moveArrayItem<T>(array: T[], fromIndex: number, toIndex: number): T[] {
  const result = [...array];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

/**
 * 安全な配列アクセス（範囲外チェック）
 */
export function safeArrayAccess<T>(array: T[], index: number): T | undefined {
  if (index < 0 || index >= array.length) {
    return undefined;
  }
  return array[index];
}

/**
 * 配列が空でないことを確認する型ガード
 */
export function isNonEmptyArray<T>(array: T[]): array is [T, ...T[]] {
  return array.length > 0;
}

/**
 * 配列から最初と最後の要素を取得
 */
export function getFirstAndLast<T>(array: T[]): { first?: T; last?: T } {
  if (array.length === 0) {
    return { first: undefined, last: undefined };
  }
  return {
    first: array[0],
    last: array[array.length - 1]
  };
}