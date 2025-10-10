import type { PanelId } from '@shared/types';

export type PanelState = Partial<Record<PanelId, boolean>>;

export interface CanOpenOptions {
  exclusiveWith?: PanelId[];
  exclusive?: boolean; 
}

export function isOpen(state: PanelState | undefined, id: PanelId): boolean {
  return !!(state ?? {})[id];
}

export function canOpen(
  current: PanelState | undefined,
  _id: PanelId,
  opts: CanOpenOptions = {}
): boolean {
  const open = current ?? {};
  if (opts.exclusiveWith) {
    for (const other of opts.exclusiveWith) {
      if (open[other]) return false;
    }
  }
  return true;
}

export function applyOpen(
  current: PanelState | undefined,
  id: PanelId,
  opts: CanOpenOptions = {}
): PanelState {
  const open = { ...(current ?? {}) } as PanelState;
  if (!canOpen(open, id, opts)) return open;

  if (opts.exclusive) {
    
    for (const k of Object.keys(open) as PanelId[]) open[k] = false;
  }

  open[id] = true;
  return open;
}

export function applyClose(current: PanelState | undefined, id: PanelId): PanelState {
  const open = { ...(current ?? {}) } as PanelState;
  open[id] = false;
  return open;
}

export function applyToggle(
  current: PanelState | undefined,
  id: PanelId,
  opts: CanOpenOptions = {}
): PanelState {
  const open = { ...(current ?? {}) } as PanelState;
  const next = !open[id];
  if (!next) {
    open[id] = false;
    return open;
  }
  return applyOpen(open, id, opts);
}

export function closeAll(): PanelState {
  return {};
}
