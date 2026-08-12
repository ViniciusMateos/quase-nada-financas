module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src'
          },
          extensions: ['.ios.ts', '.android.ts', '.ts', '.tsx', '.js', '.jsx', '.json']
        }
      ],
      // Reanimated 4: o plugin de worklets substitui o antigo
      // 'react-native-reanimated/plugin'. Deve ser o ÚLTIMO plugin da lista.
      'react-native-worklets/plugin'
    ]
  };
};
