import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { debugLog } from '@/lib/debugLog';

type LogEntry = ReturnType<typeof debugLog.getAll>[number];

export function DebugOverlay() {
  const [entries, setEntries] = useState<LogEntry[]>(() => debugLog.getAll());
  const [open, setOpen] = useState(false);

  useEffect(() => debugLog.subscribe(setEntries), []);
  useEffect(() => debugLog.onOpen(() => setOpen(true)), []);

  return (
    <>
      {entries.length > 0 && (
        <Pressable style={styles.badge} onPress={() => setOpen(true)}>
          <Text style={styles.badgeText}>VER LOGS ({entries.length})</Text>
        </Pressable>
      )}
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      <View style={styles.modal}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Logs de erro</Text>
          <View style={styles.headerActions}>
            <Pressable onPress={() => { debugLog.clear(); setOpen(false); }}>
              <Text style={styles.clearBtn}>Limpar</Text>
            </Pressable>
            <Pressable onPress={() => setOpen(false)}>
              <Text style={styles.closeBtnText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
        <ScrollView style={styles.scroll}>
          {entries.map((e, i) => (
            <View key={i} style={styles.entry}>
              <Text style={styles.entryMeta}>
                {e.method} {e.url}{'  '}
                <Text style={e.status ? styles.status : styles.noConn}>
                  {e.status ?? 'sem conexão'}
                </Text>
              </Text>
              <Text style={styles.entryTs}>{e.timestamp}</Text>
              <Text style={styles.entryMsg}>{e.message}</Text>
              {e.body != null && (
                <Text style={styles.entryBody}>
                  {JSON.stringify(e.body, null, 2)}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    backgroundColor: '#cc0000',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    zIndex: 9999,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  modal: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingTop: 56,
  },
  headerTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  clearBtn: {
    color: '#ff4444',
    fontWeight: '600',
    fontSize: 14,
  },
  closeBtnText: {
    color: '#aaa',
    fontWeight: '600',
    fontSize: 14,
  },
  scroll: {
    flex: 1,
    padding: 12,
  },
  entry: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#cc0000',
  },
  entryMeta: {
    color: '#eee',
    fontWeight: '700',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  entryTs: {
    color: '#666',
    fontSize: 10,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  entryMsg: {
    color: '#ff6b6b',
    fontSize: 12,
    marginTop: 6,
    fontFamily: 'monospace',
  },
  entryBody: {
    color: '#ccc',
    fontSize: 11,
    marginTop: 6,
    fontFamily: 'monospace',
  },
  status: {
    color: '#ff9900',
  },
  noConn: {
    color: '#ff4444',
  },
});
