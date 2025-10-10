
import { memoryService } from '@/app/core/services';
import { generateId } from './idGenerator';
import { isDevelopment } from './env';

type EventHandler = (event: Event) => void;

interface ManagedEventListener {
  element: EventTarget;
  event: string;
  handler: EventHandler;
  id: string;
  description?: string;
}

class EventManager {
  private listeners = new Map<string, ManagedEventListener>();
  private globalHandlers = new Map<string, Set<EventHandler>>();

  
  addEventListener(
    element: EventTarget,
    event: string,
    handler: EventHandler,
    description?: string
  ): string {
    const id = generateId('listener');

    const listener: ManagedEventListener = {
      element,
      event,
      handler,
      id,
      description
    };

    this.listeners.set(id, listener);
    element.addEventListener(event, handler);

    return id;
  }

  
  addGlobalHandler(
    event: string,
    handler: EventHandler
  ): string {
    const id = generateId('listener');

    if (!this.globalHandlers.has(event)) {
      this.globalHandlers.set(event, new Set());

      
      const unifiedHandler = (e: Event) => {
        const handlers = this.globalHandlers.get(event);
        if (handlers) {
          handlers.forEach(h => {
            try {
              h(e);
            } catch (error) {
              console.warn(`Error in global ${event} handler:`, error);
            }
          });
        }
      };

      
      const target = event.startsWith('key') ? document : window;
      this.addEventListener(target, event, unifiedHandler, `Global ${event} handler`);
    }

    this.globalHandlers.get(event)!.add(handler);
    return id;
  }

  
  removeEventListener(id: string): boolean {
    const listener = this.listeners.get(id);
    if (!listener) return false;

    listener.element.removeEventListener(listener.event, listener.handler);
    this.listeners.delete(id);
    return true;
  }

  
  removeAllListenersForElement(element: EventTarget): number {
    let removed = 0;

    for (const [id, listener] of this.listeners.entries()) {
      if (listener.element === element) {
        this.removeEventListener(id);
        removed++;
      }
    }

    return removed;
  }

  
  cleanup(): void {
    console.log(`🧹 Cleaning up ${this.listeners.size} event listeners`);

    for (const [id, listener] of this.listeners.entries()) {
      try {
        listener.element.removeEventListener(listener.event, listener.handler);
      } catch (error) {
        console.warn(`Failed to remove listener ${id}:`, error);
      }
    }

    this.listeners.clear();
    this.globalHandlers.clear();
  }

  
  useEventListener(
    element: EventTarget | null,
    event: string,
    handler: EventHandler,
    description?: string
  ): () => void {
    if (!element) {
      return () => {}; 
    }

    const id = this.addEventListener(element, event, handler, description);
    return () => this.removeEventListener(id);
  }

  
  getStatus(): {
    activeListeners: number;
    globalHandlers: number;
    listenersByEvent: Record<string, number>;
  } {
    const listenersByEvent: Record<string, number> = {};

    for (const listener of this.listeners.values()) {
      listenersByEvent[listener.event] = (listenersByEvent[listener.event] || 0) + 1;
    }

    return {
      activeListeners: this.listeners.size,
      globalHandlers: this.globalHandlers.size,
      listenersByEvent
    };
  }

  
}


export const eventManager = new EventManager();


if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    eventManager.cleanup();
  });
}


export function useManagedEventListener(
  element: EventTarget | null,
  event: string,
  handler: EventHandler,
  description?: string,
  deps: any[] = []
): void {
  
  if (typeof window !== 'undefined' && 'React' in window) {
    const React = (window as any).React;
    React.useEffect(() => {
      return eventManager.useEventListener(element, event, handler, description);
    }, [element, event, handler, description, ...deps]);
  }
}


if (isDevelopment()) {
  memoryService.createManagedInterval(() => {
    const status = eventManager.getStatus();
    if (status.activeListeners > 50) {
      console.warn(`⚠️ High listener count: ${status.activeListeners} active listeners`, status.listenersByEvent);
    }
  }, 30000, 'EventManager dev monitor');
}


if (typeof import.meta !== 'undefined' && (import.meta as any).hot) {
  (import.meta as any).hot.dispose(() => {
    try { eventManager.cleanup(); } catch {  }
  });
}
