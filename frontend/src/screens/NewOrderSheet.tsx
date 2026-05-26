import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { authService } from '@/services/auth.service';
import { binanceService } from '@/services/binance.service';
import { biometricAuth } from '@/lib/biometricAuth';
import { normalizeError } from '@/lib/errorMap';
import { openBinanceDeposit } from '@/lib/binanceDeposit';
import { formatCurrency } from '@/lib/formatters';
import { BottomSheet } from '@/ui/BottomSheet';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';

const symbols = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL'];

export default function NewOrderSheet() {
  const navigation = useNavigation<any>();
  const { isDemo } = useAuth();
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
      // No demo não há biometria nem challenge real — ordem é simulada.
      let biometricToken = 'demo';
      if (!isDemo) {
        await biometricAuth.authenticate();
        const challenge = await authService.biometricChallenge();
        biometricToken = challenge.biometricToken;
      }
      const order = await binanceService.placeOrder({
        asset: symbol,
        amountBrl: numericAmount,
        biometricToken,
      });
      navigation.replace('OrderResult', { order });
    } catch (err) {
      const normalized = normalizeError(err);
      if (normalized.code === 'INSUFFICIENT_BALANCE') {
        Alert.alert(
          'Saldo insuficiente',
          `Você não tem saldo na Binance pra comprar ${formatCurrency(numericAmount)} em ${symbol}. Carregue sua conta via Pix e tente de novo.`,
          [
            { text: 'Agora não', style: 'cancel' },
            { text: 'Carregar Binance', onPress: () => openBinanceDeposit() },
          ]
        );
      } else {
        Alert.alert('Não foi possível criar a ordem', normalized.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <BottomSheet onClose={() => navigation.goBack()}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 24 }}
        >
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
          <Button label={isDemo ? 'Confirmar ordem' : 'Confirmar com Face ID'} icon="finger-print" loading={loading} onPress={submit} />
          <Button label="Cancelar" variant="secondary" onPress={() => navigation.goBack()} style={{ marginTop: 8 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  symbols: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  estimate: { fontSize: 13, marginTop: 6, marginBottom: 6 },
});
