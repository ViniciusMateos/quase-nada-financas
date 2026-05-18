import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

const THROTTLE_MS = 30_000;

export function useForegroundRefresh(callback: () => void | Promise<void>) {
  const lastRunRef = useRef(0);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let prev: AppStateStatus = AppState.currentState;

    const sub = AppState.addEventListener('change', (next) => {
      const wasInBackground = prev.match(/inactive|background/);
      if (wasInBackground && next === 'active') {
        const now = Date.now();
        if (now - lastRunRef.current >= THROTTLE_MS) {
          lastRunRef.current = now;
          void callbackRef.current();
        }
      }
      prev = next;
    });

    return () => sub.remove();
  }, []);
}
