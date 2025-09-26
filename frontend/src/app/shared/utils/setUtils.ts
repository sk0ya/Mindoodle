/**
 * Set操作の効率的なヘルパー関数
 * 不必要なSet作成を回避してメモリ使用量を削減
 */

/**
 * Setに要素を追加するか削除する（トグル操作）
 * 状態が変更されない場合は元のSetを返す
 */
export function toggleSetItem<T>(set: Set<T>, item: T): Set<T> {
  if (set.has(item)) {
    if (set.size === 1) {
      // 最後の要素を削除する場合は新しい空のSetを返す
      return new Set<T>();
    }
    const newSet = new Set(set);
    newSet.delete(item);
    return newSet;
  } else {
    const newSet = new Set(set);
    newSet.add(item);
    return newSet;
  }
}

/**
 * Setから要素を削除
 * 要素が存在しない場合は元のSetを返す
 */
export function removeFromSet<T>(set: Set<T>, item: T): Set<T> {
  if (!set.has(item)) {
    return set; // 変更不要
  }

  if (set.size === 1) {
    return new Set<T>(); // 空のSet
  }

  const newSet = new Set(set);
  newSet.delete(item);
  return newSet;
}

/**
 * Setに要素を追加
 * 要素が既に存在する場合は元のSetを返す
 */
export function addToSet<T>(set: Set<T>, item: T): Set<T> {
  if (set.has(item)) {
    return set; // 変更不要
  }

  const newSet = new Set(set);
  newSet.add(item);
  return newSet;
}

/**
 * 複数の要素をSetから削除
 * 効率的なバッチ削除
 */
export function removeMultipleFromSet<T>(set: Set<T>, items: T[]): Set<T> {
  const itemsToRemove = items.filter(item => set.has(item));

  if (itemsToRemove.length === 0) {
    return set; // 変更不要
  }

  const newSet = new Set(set);
  itemsToRemove.forEach(item => newSet.delete(item));
  return newSet;
}

/**
 * Set操作をバッチで実行
 * 複数の操作を一度に行い、無駄なSet作成を避ける
 */
export function batchSetOperations<T>(
  set: Set<T>,
  operations: Array<{ type: 'add' | 'delete'; item: T }>
): Set<T> {
  let hasChanges = false;
  const newSet = new Set(set);

  for (const op of operations) {
    if (op.type === 'add' && !newSet.has(op.item)) {
      newSet.add(op.item);
      hasChanges = true;
    } else if (op.type === 'delete' && newSet.has(op.item)) {
      newSet.delete(op.item);
      hasChanges = true;
    }
  }

  return hasChanges ? newSet : set;
}