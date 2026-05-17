import { Pressable, StyleSheet, Text, View } from 'react-native';
import { debugLog } from '@/lib/debugLog';
import { useTheme } from '@/contexts/ThemeContext';

type Props = {
  message: string;
  hint?: { label: string; onPress: () => void };
};

export function FormError({ message, hint }: Props) {
  const { colors, radius, mode } = useTheme();
  const bg = mode === 'dark' ? 'rgba(255, 92, 117, 0.10)' : '#FEE4E2';
  const border = mode === 'dark' ? 'rgba(255, 92, 117, 0.45)' : '#FDA29B';
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: bg, borderColor: border, borderRadius: radius.md },
      ]}
    >
      <View style={styles.row}>
        <Text style={[styles.icon, { backgroundColor: colors.brandTextError }]}>!</Text>
        <Text style={[styles.message, { color: colors.brandTextError }]}>{message}</Text>
      </View>
      {hint ? (
        <Pressable onPress={hint.onPress} hitSlop={8} style={styles.hintPressable}>
          <Text style={[styles.hint, { color: colors.brandTextError }]}>{hint.label}</Text>
        </Pressable>
      ) : null}
      <Pressable onPress={() => debugLog.openModal()} hitSlop={8}>
        <Text style={[styles.verLogs, { color: colors.brandTextError }]}>VER LOGS</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    color: '#FFFFFF',
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 22,
    overflow: 'hidden',
  },
  message: { flexShrink: 1, fontWeight: '700', fontSize: 14 },
  hintPressable: { paddingVertical: 2 },
  hint: { fontWeight: '700', textDecorationLine: 'underline' },
  verLogs: { fontWeight: '900', fontSize: 10, textDecorationLine: 'underline', opacity: 0.7 },
});
