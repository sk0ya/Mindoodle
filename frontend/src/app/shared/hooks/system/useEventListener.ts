import { useEffect } from 'react';
import { useLatestRef } from '../utilities';


export interface UseEventListenerOptions {
  
  target?: Window | Document | HTMLElement | null;
  
  capture?: boolean;
  
  passive?: boolean;
  
  enabled?: boolean;
}


export function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  options?: UseEventListenerOptions
): void;

export function useEventListener<K extends keyof DocumentEventMap>(
  eventName: K,
  handler: (event: DocumentEventMap[K]) => void,
  options?: UseEventListenerOptions & { target: Document }
): void;

export function useEventListener<K extends keyof HTMLElementEventMap>(
  eventName: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  options?: UseEventListenerOptions & { target: HTMLElement }
): void;

export function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  options: UseEventListenerOptions = {}
): void {
  const {
    target = typeof window !== 'undefined' ? window : null,
    capture = false,
    passive = false,
    enabled = true
  } = options;

  
  const handlerRef = useLatestRef(handler);

  useEffect(() => {
    
    if (!enabled || !target) return;

    
    const eventListener = (event: Event) => {
      handlerRef.current(event as WindowEventMap[K]);
    };

    const listenerOptions: AddEventListenerOptions = {
      capture,
      passive
    };

    
    target.addEventListener(eventName, eventListener, listenerOptions);

    
    return () => {
      target.removeEventListener(eventName, eventListener, listenerOptions);
    };
  }, [eventName, target, capture, passive, enabled]);
}
