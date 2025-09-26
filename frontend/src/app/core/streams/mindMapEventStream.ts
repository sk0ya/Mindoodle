import { logger } from '@shared/utils';

// Simple in-memory event bus for mind map model changes
export type MindMapEventType =
  | 'model.changed' // generic model mutation committed to tree
  | 'layout.applied' // auto layout updated positions
  | 'links.changed' // link add/update/delete
  | 'model.reset'; // loaded/replaced entire model

export interface MindMapEvent<T = any> {
  type: MindMapEventType;
  payload?: T;
  at?: number; // ms timestamp
  source?: string; // optional source tag
}

type Subscriber = (event: MindMapEvent) => void;

export class MindMapEventBus {
  private subscribers = new Set<Subscriber>();

  subscribe(cb: Subscriber): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  emit<T = any>(event: MindMapEvent<T>): void {
    const e = { ...event, at: event.at ?? Date.now() };
    logger.debug('📢 MindMapEvent', { type: e.type });
    for (const cb of Array.from(this.subscribers)) {
      try {
        cb(e);
      } catch (_err) {
        // keep other subscribers alive
      }
    }
  }
}

// Singleton bus used across the app
export const mindMapEvents = new MindMapEventBus();

