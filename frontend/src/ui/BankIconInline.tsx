import { Image, View } from 'react-native';
import { inlineLogoUrl } from '@/lib/bankAccountLabel';

type Props = {
  bankName?: string | null;
  size?: number;
};

function toRenderableImageUrl(url: string, size: number): string {
  if (!url.toLowerCase().endsWith('.svg')) return url;
  const noProtocol = url.replace(/^https?:\/\//i, '');
  const px = Math.max(48, Math.round(size * 3));
  return `https://images.weserv.nl/?url=${encodeURIComponent(noProtocol)}&output=png&w=${px}&h=${px}&fit=contain`;
}

/**
 * Logo pequeno e transparente do banco, para usar inline ao lado de texto
 * (ex: rótulo da conta na linha de uma transação). Retorna null se o banco
 * não estiver no mapping.
 */
export function BankIconInline({ bankName, size = 12 }: Props) {
  const url = inlineLogoUrl(bankName);
  if (!url) return null;
  const safe = toRenderableImageUrl(url, size);
  return (
    <View style={{ width: size, height: size, marginRight: 4 }}>
      <Image
        source={{ uri: safe }}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </View>
  );
}
