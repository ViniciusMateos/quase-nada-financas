type LogEntry = {
  timestamp: string;
  method: string;
  url: string;
  status: number | null;
  body: unknown;
  message: string;
};

type Listener = (entries: LogEntry[]) => void;
type OpenListener = () => void;

const entries: LogEntry[] = [];
const listeners: Set<Listener> = new Set();
const openListeners: Set<OpenListener> = new Set();

function notify() {
  listeners.forEach((l) => l([...entries]));
}

export const debugLog = {
  push(entry: Omit<LogEntry, 'timestamp'>) {
    entries.unshift({ ...entry, timestamp: new Date().toISOString() });
    if (entries.length > 50) entries.pop();
    notify();
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  onOpen(l: OpenListener) {
    openListeners.add(l);
    return () => openListeners.delete(l);
  },
  openModal() {
    openListeners.forEach((l) => l());
  },
  getAll(): LogEntry[] {
    return [...entries];
  },
  clear() {
    entries.length = 0;
    notify();
  },
};
