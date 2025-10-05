import { useMindMapStore } from '@mindmap/store';
import type { CanvasEvent } from './EventStrategy';
import { NormalModeStrategy } from './CanvasEvent.normal';
import { InsertModeStrategy } from './CanvasEvent.insert';
import { VisualModeStrategy } from './CanvasEvent.visual';

function getStrategy(mode: 'normal' | 'insert' | 'visual' | 'menu') {
  switch (mode) {
    case 'insert': return new InsertModeStrategy();
    case 'visual': return new VisualModeStrategy();
    case 'normal':
    default: return new NormalModeStrategy();
  }
}

export function dispatchCanvasEvent(event: CanvasEvent) {
  try {
    const currentMode = (useMindMapStore.getState()?.ui?.mode ?? 'normal') as 'normal'|'insert'|'visual'|'menu';
    const strategy = getStrategy(currentMode);
    strategy.handle(event);
  } catch {
    // no-op
  }
}

