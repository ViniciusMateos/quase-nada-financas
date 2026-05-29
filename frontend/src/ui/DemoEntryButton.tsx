import { GestureResponderEvent, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Link discreto "Ver demonstração" — entra no modo demo com dados fictícios.
 * Usado nas telas de autenticação (AccountHub, Login, Register). Captura a
 * posição do toque pra o círculo verde da transição crescer a partir do dedo.
 */
export function DemoEntryButton({ style }: { style?: ViewStyle }) {
  const { enterDemo } = useAuth();
  const { colors } = useTheme();
  const handlePress = (e: GestureResponderEvent) => {
    enterDemo({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
  };
  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      style={[styles.btn, style]}
      accessibilityLabel="Ver demonstração com dados fictícios"
    >
      <Ionicons name="play-circle-outline" size={16} color={colors.brandTextSecondary} />
      <Text style={[styles.text, { color: colors.brandTextSecondary }]}>Ver demonstração</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  text: { fontSize: 14, fontWeight: '700' },
});
