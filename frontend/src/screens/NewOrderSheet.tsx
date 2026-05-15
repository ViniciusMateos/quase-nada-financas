import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { authService } from '@/services/auth.service';
import { binanceService } from '@/services/binance.service';
import { biometricAuth } from '@/lib/biometricAuth';
import { normalizeError } from '@/lib/errorMap';
import { formatCurrency } from '@/lib/formatters';
import { theme } from '@/theme/theme';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';

const symbols = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL'];

export default function NewOrderSheet() {
  const navigation = useNavigation<any>();
  const [symbol, setSymbol] = useState('BTC');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const numericAmount = Number(amount.replace(',', '.'));

  async function submit() {
    if (!numericAmount || numericAmount <= 0) return Alert.alert('Valor invalido', 'Digite um valor valido para a ordem.');
    setLoading(true);
    try {
      const challenge = await authService.biometricChallenge();
      await biometricAuth.authenticate();
      const order = await binanceService.placeOrder({ symbol, side: 'buy', amountBRL: numericAmount, challengeToken: challenge.challengeToken });
      navigation.replace('OrderResult', { order });
    } catch (err) {
      Alert.alert('Nao foi possivel criar a ordem', normalizeError(err).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Nova Ordem</Text>
        <View style={styles.symbols}>
          {symbols.map((item) => <Pressable key={item} onPress={() => setSymbol(item)} style={[styles.chip, item === symbol && styles.chipSelected]}><Text>{item}</Text></Pressable>)}
        </View>
        <TextField label="Valor em BRL" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Text style={styles.estimate}>Estimativa: {numericAmount ? formatCurrency(numericAmount) : 'R$ 0,00'} em {symbol}</Text>
        <Button label="Confirmar com Face ID" icon="finger-print" loading={loading} onPress={submit} />
        <Button label="Cancelar" variant="secondary" onPress={() => navigation.goBack()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.brandOverlay },
  sheet: { padding: 16, gap: 16, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, backgroundColor: theme.colors.brandSurface },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: theme.colors.brandDivider, alignSelf: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  symbols: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.colors.brandDivider },
  chipSelected: { backgroundColor: theme.colors.brandPrimaryTint, borderColor: theme.colors.brandPrimary },
  estimate: { color: theme.colors.brandTextSecondary }
});
