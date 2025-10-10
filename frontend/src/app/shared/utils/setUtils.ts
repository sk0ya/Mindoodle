


export function toggleSetItem<T>(set: Set<T>, item: T): Set<T> {
  if (set.has(item)) {
    if (set.size === 1) {
      
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


export function removeFromSet<T>(set: Set<T>, item: T): Set<T> {
  if (!set.has(item)) {
    return set; 
  }

  if (set.size === 1) {
    return new Set<T>(); 
  }

  const newSet = new Set(set);
  newSet.delete(item);
  return newSet;
}


export function addToSet<T>(set: Set<T>, item: T): Set<T> {
  if (set.has(item)) {
    return set; 
  }

  const newSet = new Set(set);
  newSet.add(item);
  return newSet;
}


export function removeMultipleFromSet<T>(set: Set<T>, items: T[]): Set<T> {
  const itemsToRemove = items.filter(item => set.has(item));

  if (itemsToRemove.length === 0) {
    return set; 
  }

  const newSet = new Set(set);
  itemsToRemove.forEach(item => newSet.delete(item));
  return newSet;
}


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