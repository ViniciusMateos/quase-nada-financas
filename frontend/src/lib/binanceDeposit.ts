import { Linking } from 'react-native';

// Deep links do app nativo da Binance, em ordem de preferência.
// Tenta abrir direto (sem canOpenURL, que falha no Expo Go por scheme não
// declarado). Se nenhum abrir, cai pro site.
const BINANCE_APP_LINKS = [
  'bnc://app.binance.com/payment/depositChannel?fiat=BRL',
  'bnc://app.binance.com/deposit/fiat/BRL',
  'binance://',
  'bnc://',
];
const BINANCE_WEB_DEPOSIT = 'https://www.binance.com/pt-BR/my/wallet/account/main/deposit/fiat/BRL';

export async function openBinanceDeposit(): Promise<void> {
  for (const link of BINANCE_APP_LINKS) {
    try {
      await Linking.openURL(link);
      return; // abriu o app
    } catch {
      // tenta o próximo
    }
  }
  // Nenhum scheme do app abriu — usa o site
  await Linking.openURL(BINANCE_WEB_DEPOSIT).catch(() => undefined);
}
