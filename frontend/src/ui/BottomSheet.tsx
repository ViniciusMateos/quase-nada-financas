import { ReactNode, useEffect } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

type Props = {
  visible?: boolean;
  onClose: () => void;
  children: ReactNode;
  maxHeightFraction?: number;
  /**
   * Quando true, envolve em <Modal> nativo do RN — garante fullscreen overlay
   * mesmo quando renderizado inline (dentro de outra tela). Use false (default)
   * quando o BottomSheet for usado como Stack.Screen com presentation:'transparentModal'.
   */
  asNativeModal?: boolean;
};

const SPRING_CONFIG = { damping: 20, stiffness: 220, mass: 0.7 };

export function BottomSheet({ visible = true, onClose, children, maxHeightFraction = 0.85, asNativeModal = false }: Props) {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetMaxHeight = windowHeight * maxHeightFraction;

  const translateY = useSharedValue(sheetMaxHeight);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, SPRING_CONFIG);
    } else {
      translateY.value = withTiming(sheetMaxHeight, { duration: 200 });
    }
  }, [visible, sheetMaxHeight, translateY]);

  const close = () => {
    translateY.value = withTiming(sheetMaxHeight, { duration: 220 }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  };

  const pan = Gesture.Pan()
    .onUpdate((evt) => {
      if (evt.translationY > 0) {
        translateY.value = evt.translationY;
      }
    })
    .onEnd((evt) => {
      const shouldClose = evt.translationY > 120 || evt.velocityY > 800;
      if (shouldClose) {
        translateY.value = withTiming(sheetMaxHeight, { duration: 220 }, (finished) => {
          if (finished) runOnJS(onClose)();
        });
      } else {
        translateY.value = withSpring(0, SPRING_CONFIG);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateY.value,
      [0, sheetMaxHeight],
      [1, 0],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  const content = (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.brandOverlay }, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Fechar" />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.brandSurface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            maxHeight: sheetMaxHeight,
            paddingBottom: Math.max(insets.bottom, 16),
          },
          sheetStyle,
        ]}
      >
        <GestureDetector gesture={pan}>
          <View style={styles.handleArea}>
            <View style={[styles.handle, { backgroundColor: colors.brandDivider }]} />
          </View>
        </GestureDetector>
        <View style={styles.body}>{children}</View>
      </Animated.View>
    </View>
  );

  if (asNativeModal) {
    return (
      <Modal transparent animationType="none" visible={visible} onRequestClose={close} statusBarTranslucent>
        {content}
      </Modal>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  handleArea: { paddingVertical: 14, alignItems: 'center' },
  handle: { width: 44, height: 5, borderRadius: 3 },
  body: { paddingHorizontal: 16 },
});

// previne warnings de unused
void Dimensions;
