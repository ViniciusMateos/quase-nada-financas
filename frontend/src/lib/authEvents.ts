type Listener = () => void;
const listeners = new Set<Listener>();

export const authEvents = {
  onForceLogout(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  forceLogout() {
    listeners.forEach((listener) => listener());
  }
};
