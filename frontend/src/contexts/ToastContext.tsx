import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/theme/theme';
import { debugLog } from '@/lib/debugLog';

type ToastKind = 'success' | 'error' | 'info';
type Toast = { id: number; message: string; kind: ToastKind };
type ToastContextValue = {
  show(message: string, kind?: ToastKind): void;
  hide(id: number): void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const hide = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = Date.now();
    setToasts((current) => [...current, { id, message, kind }]);
    setTimeout(() => hide(id), 3500);
  }, [hide]);

  const value = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={styles.container}>
        {toasts.map((toast) => (
          <Pressable key={toast.id} onPress={() => hide(toast.id)} style={[styles.toast, styles[toast.kind]]}>
            <Text style={styles.text}>{toast.message}</Text>
            {toast.kind === 'error' && (
              <Pressable onPress={() => debugLog.openModal()} hitSlop={8}>
                <Text style={styles.verLogs}>VER LOGS</Text>
              </Pressable>
            )}
          </Pressable>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast deve ser usado dentro de ToastProvider');
  return context;
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 16, right: 16, bottom: 24, gap: 8 },
  toast: { padding: 14, borderRadius: theme.radius.md, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, elevation: 4 },
  success: { backgroundColor: theme.colors.brandSuccess },
  error: { backgroundColor: theme.colors.brandError },
  info: { backgroundColor: theme.colors.brandInfo },
  text: { color: '#FFFFFF', fontWeight: '700' },
  verLogs: { color: '#FFFFFF', fontWeight: '900', fontSize: 11, marginTop: 6, textDecorationLine: 'underline', opacity: 0.9 },
});
