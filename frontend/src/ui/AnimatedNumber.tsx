import { useEffect, useRef, useState } from 'react';
import { Text, TextProps } from 'react-native';
import { Easing, runOnJS, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';

type Props = TextProps & {
  value: number;
  format?: (n: number) => string;
  durationMs?: number;
  start?: number;
};

/**
 * Anima de start->value na primeira renderização e, em updates posteriores,
 * pula direto pro novo valor (evita "ticker" re-disparando a cada re-render do pai).
 */
export function AnimatedNumber({
  value,
  format = (n) => n.toFixed(2),
  durationMs = 900,
  start = 0,
  ...textProps
}: Props) {
  const animValue = useSharedValue(start);
  const [display, setDisplay] = useState(start);
  const animatedOnceRef = useRef(false);

  useEffect(() => {
    if (!animatedOnceRef.current) {
      animValue.value = withTiming(value, { duration: durationMs, easing: Easing.out(Easing.cubic) });
      animatedOnceRef.current = true;
    } else {
      animValue.value = value;
    }
  }, [value, durationMs, animValue]);

  useAnimatedReaction(
    () => animValue.value,
    (current) => {
      runOnJS(setDisplay)(current);
    }
  );

  return <Text {...textProps}>{format(display)}</Text>;
}
