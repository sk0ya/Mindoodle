import { useEffect } from 'react';
import { useLatestRef } from '../utilities';


export interface UseEventListenerOptions {
  target?: Window | Document | HTMLElement | null;
  capture?: boolean;
  passive?: boolean;
  enabled?: boolean;
}

export function useEventListener(
  eventName: string,
  handler: (event: Event) => void,
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
      handlerRef.current(event);
    };

    const listenerOptions: AddEventListenerOptions = {
      capture,
      passive
    };

    
    target.addEventListener(eventName, eventListener, listenerOptions);

    
    return () => {
      target.removeEventListener(eventName, eventListener, listenerOptions);
    };
  }, [eventName, target, capture, passive, enabled, handlerRef]);
}
