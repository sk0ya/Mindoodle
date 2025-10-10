import { logger } from '@shared/utils';


export type MindMapEventType =
  | 'model.changed' 
  | 'layout.applied' 
  | 'links.changed' 
  | 'model.reset'; 

export interface MindMapEvent<T = any> {
  type: MindMapEventType;
  payload?: T;
  at?: number; 
  source?: string; 
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
        
      }
    }
  }
}


export const mindMapEvents = new MindMapEventBus();

