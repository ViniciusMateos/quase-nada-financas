import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, View } from 'react-native';

type Props = {
  size?: number;
  color?: string;
};

/**
 * Loader com o cachorro do Quase Nada + anel girando em volta.
 * Replicado do app de Lembretes, adaptado pra cor verde do Finanças.
 */
export function LoadingDog({ size = 56, color = '#22C55E' }: Props) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isMounted = true;
    let animation: Animated.CompositeAnimation | undefined;

    const spin = () => {
      rotation.setValue(0);
      animation = Animated.timing(rotation, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      });
      animation.start(({ finished }) => {
        if (finished && isMounted) spin();
      });
    };

    spin();
    return () => {
      isMounted = false;
      animation?.stop();
    };
  }, [rotation]);

  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const ring = Math.round(size * 0.82);
  const imageSize = Math.round(size * 0.82);
  const stroke = Math.max(1, size * 0.032);
  const ringOffsetX = size * -0.013;
  const ringOffsetY = size * -0.039;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: ring,
          height: ring,
          borderRadius: ring / 2,
          borderWidth: stroke,
          borderColor: 'transparent',
          borderTopColor: color,
          borderRightColor: color,
          transform: [{ translateX: ringOffsetX }, { translateY: ringOffsetY }, { rotate }],
        }}
      />
      <Image
        source={require('../../assets/apenas-cachorro.png')}
        style={{ width: imageSize, height: imageSize, resizeMode: 'contain', tintColor: color }}
      />
    </View>
  );
}
