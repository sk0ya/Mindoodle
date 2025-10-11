import type { UIMode } from '@shared/types';




export function canTransition(_from: UIMode, _to: UIMode): boolean {
  return true;
}

export function nextMode(current: UIMode, requested: UIMode): UIMode {
  return canTransition(current, requested) ? requested : current;
}

export function isInsertLike(mode: UIMode): boolean {
  return mode === 'insert';
}

export function isVisualLike(mode: UIMode): boolean {
  return mode === 'visual';
}
