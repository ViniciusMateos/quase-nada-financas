import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Faixa fixa no topo enquanto o app está em MODO DEMONSTRAÇÃO. Deixa claro que
 * os dados são fictícios e dá uma saída visível de qualquer tela. Renderiza
 * null fora do demo (sem impacto no layout normal).
 */
export function DemoBanner() {
  const { isDemo, exitDemo } = useAuth();
  const insets = useSafeAreaInsets();
  if (!isDemo) return null;
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
      <Ionicons name="play-circle" size={14} color="#FFFFFF" />
      <Text style={styles.text} numberOfLines={1}>
        Modo demonstração · dados fictícios
      </Text>
      <Pressable onPress={exitDemo} hitSlop={10} style={styles.exitBtn} accessibilityLabel="Sair da demonstração">
        <Text style={styles.exitText}>Sair</Text>
        <Ionicons name="close" size={14} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#7C3AED',
  },
  text: { flex: 1, color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  exitBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  exitText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
});
