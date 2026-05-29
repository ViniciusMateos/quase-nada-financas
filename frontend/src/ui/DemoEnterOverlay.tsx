import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { uiEvents, type DemoEnterOrigin } from '@/lib/uiEvents';
import { LoadingDog } from '@/ui/LoadingDog';

/**
 * Transição de entrada no MODO DEMONSTRAÇÃO: um círculo verde preenche a tela,
 * o cachorro carrega no centro e então o overlay some, revelando a demo já
 * montada por baixo. Vive na raiz (App.tsx) porque a troca de navegação
 * desmonta a tela de onde o usuário tocou — aqui o overlay persiste.
 */
export function DemoEnterOverlay() {
  const { commitDemo } = useAuth();
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const [active, setActive] = useState(false);
  const [origin, setOrigin] = useState<DemoEnterOrigin | null>(null);

  const reveal = useRef(new Animated.Value(0)).current; // círculo verde: 0 → 1
  const dog = useRef(new Animated.Value(0)).current; // cachorro: fade in
  const fade = useRef(new Animated.Value(1)).current; // overlay: fade out no fim

  useEffect(() => {
    return uiEvents.onDemoEnter((o) => {
      setOrigin(o ?? null);
      reveal.setValue(0);
      dog.setValue(0);
      fade.setValue(1);
      setActive(true);

      Animated.timing(reveal, {
        toValue: 1,
        duration: 440,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        // Tela já coberta de verde → faz a troca por baixo e revela o cachorro.
        commitDemo();
        Animated.timing(dog, { toValue: 1, duration: 220, useNativeDriver: true }).start();
        setTimeout(() => {
          Animated.timing(fade, {
            toValue: 0,
            duration: 380,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (finished) setActive(false);
          });
        }, 850);
      });
    });
  }, [reveal, dog, fade, commitDemo]);

  if (!active) return null;

  // Centro do círculo = onde o dedo tocou (com fallback pro centro da tela).
  // Diâmetro = 2× a distância pro canto mais distante a partir desse ponto,
  // com folga, pra garantir que o verde cubra toda a tela ao chegar em scale 1.
  const cx = origin?.x ?? width / 2;
  const cy = origin?.y ?? height / 2;
  const farthest = Math.max(
    Math.hypot(cx, cy),
    Math.hypot(width - cx, cy),
    Math.hypot(cx, height - cy),
    Math.hypot(width - cx, height - cy)
  );
  const diameter = Math.ceil(farthest * 2 * 1.08);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.container, { opacity: fade }]} pointerEvents="auto">
      <Animated.View
        style={{
          position: 'absolute',
          width: diameter,
          height: diameter,
          left: cx - diameter / 2,
          top: cy - diameter / 2,
          borderRadius: diameter / 2,
          backgroundColor: colors.brandPrimary,
          transform: [{ scale: reveal }],
        }}
      />
      <Animated.View style={[styles.center, { opacity: dog }]}>
        <LoadingDog size={72} color="#FFFFFF" />
        <Text style={styles.label}>Carregando demonstração…</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', gap: 16 },
  label: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
});
