import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { authService } from '@/services/auth.service';
import { binanceService } from '@/services/binance.service';
import { biometricAuth } from '@/lib/biometricAuth';
import { normalizeError } from '@/lib/errorMap';
import { formatCurrency } from '@/lib/formatters';
import { BottomSheet } from '@/ui/BottomSheet';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';

const symbols = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL'];

export default function NewOrderSheet() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const [symbol, setSymbol] = useState('BTC');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const numericAmount = Number(amount.replace(',', '.'));

  async function submit() {
    if (!numericAmount || numericAmount <= 0)
      return Alert.alert('Valor inválido', 'Digite um valor válido para a ordem.');
    setLoading(true);
    try {
      const challenge = await authService.biometricChallenge();
      await biometricAuth.authenticate();
      const order = await binanceService.placeOrder({
        symbol,
        side: 'buy',
        amountBRL: numericAmount,
        challengeToken: challenge.challengeToken,
      });
      navigation.replace('OrderResult', { order });
    } catch (err) {
      Alert.alert('Não foi possível criar a ordem', normalizeError(err).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <BottomSheet onClose={() => navigation.goBack()}>
      <Text style={[styles.title, { color: colors.brandTextPrimary }]}>Nova ordem</Text>
      <View style={styles.symbols}>
        {symbols.map((item) => {
          const active = item === symbol;
          return (
            <Pressable
              key={item}
              onPress={() => setSymbol(item)}
              style={[
                styles.chip,
                {
                  borderColor: active ? colors.brandPrimary : colors.brandDivider,
                  backgroundColor: active ? colors.brandPrimaryTint : 'transparent',
                },
              ]}
            >
              <Text style={{ color: active ? colors.brandPrimaryDark : colors.brandTextSecondary, fontWeight: '700' }}>
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <TextField label="Valor em BRL" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Text style={[styles.estimate, { color: colors.brandTextSecondary }]}>
        Estimativa: {numericAmount ? formatCurrency(numericAmount) : 'R$ 0,00'} em {symbol}
      </Text>
      <Button label="Confirmar com Face ID" icon="finger-print" loading={loading} onPress={submit} />
      <Button label="Cancelar" variant="secondary" onPress={() => navigation.goBack()} style={{ marginTop: 8 }} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  symbols: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  estimate: { fontSize: 13, marginTop: 6, marginBottom: 6 },
});
