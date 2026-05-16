import { Pressable, StyleSheet, Text, View } from 'react-native';
import { debugLog } from '@/lib/debugLog';
import { theme } from '@/theme/theme';

type Props = { message: string };

export function FormError({ message }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      <Pressable onPress={() => debugLog.openModal()} hitSlop={8}>
        <Text style={styles.verLogs}>VER LOGS</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 4 },
  message: { color: theme.colors.brandTextError, fontWeight: '700', textAlign: 'center' },
  verLogs: { color: theme.colors.brandTextError, fontWeight: '900', fontSize: 11, textDecorationLine: 'underline' },
});
