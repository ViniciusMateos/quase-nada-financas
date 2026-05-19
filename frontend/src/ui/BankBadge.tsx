import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  bankName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  size?: number;
  /**
   * Mantido por compatibilidade com callers antigos — atualmente ignorado.
   * Todos os bancos renderizam como squircle preenchido. Padding interno
   * é controlado pela lista `PADDED_FILL` abaixo (hoje só Mercado Pago).
   */
  variant?: 'filled' | 'padded';
};

/**
 * React Native <Image> não renderiza SVG nativo. Usamos o weserv.nl como
 * proxy gratuito que converte SVG → PNG na borda. Pra logos do Pluggy:
 * https://cdn.pluggy.ai/assets/connector-icons/X.svg
 *   → https://images.weserv.nl/?url=cdn.pluggy.ai/.../X.svg&output=png&w=128&h=128
 */
function toRenderableImageUrl(url: string, size: number): string {
  if (!url.toLowerCase().endsWith('.svg')) return url;
  const noProtocol = url.replace(/^https?:\/\//i, '');
  const px = Math.max(64, Math.round(size * 3));
  return `https://images.weserv.nl/?url=${encodeURIComponent(noProtocol)}&output=png&w=${px}&h=${px}&fit=contain`;
}

/**
 * Bancos cujo logo precisa de respiro interno (padding) — o SVG do conector
 * vem grudado nas bordas e fica feio se cobrir 100% do squircle.
 * Demais bancos: logo cobre todo o squircle sem padding.
 */
const PADDED_FILL: RegExp[] = [
  /mercado pago/i,
];

const BANK_COLORS: Array<{ match: RegExp; bg: string; fg: string; initials?: string }> = [
  { match: /mercado pago|meupluggy|pluggy/i, bg: '#00B0FF', fg: '#FFFFFF', initials: 'MP' },
  { match: /nubank|nu pagamentos/i, bg: '#820AD1', fg: '#FFFFFF', initials: 'Nu' },
  { match: /ita[uú]/i, bg: '#EC7000', fg: '#FFFFFF', initials: 'It' },
  { match: /bradesco/i, bg: '#CC092F', fg: '#FFFFFF', initials: 'Br' },
  { match: /santander/i, bg: '#EC0000', fg: '#FFFFFF', initials: 'Sa' },
  { match: /banco do brasil|^bb$/i, bg: '#FFC72C', fg: '#003DA5', initials: 'BB' },
  { match: /caixa/i, bg: '#005CA9', fg: '#FFFFFF', initials: 'Cx' },
  { match: /inter/i, bg: '#FF7A00', fg: '#FFFFFF', initials: 'In' },
  { match: /c6/i, bg: '#000000', fg: '#FFE600', initials: 'C6' },
  { match: /pic ?pay/i, bg: '#11C76F', fg: '#FFFFFF', initials: 'PP' },
  { match: /pan/i, bg: '#0E1A40', fg: '#FFFFFF', initials: 'Pn' },
  { match: /bmg/i, bg: '#F37021', fg: '#FFFFFF', initials: 'BM' },
  { match: /xp invest/i, bg: '#000000', fg: '#FFE000', initials: 'XP' },
  { match: /sofisa/i, bg: '#001D77', fg: '#FFFFFF', initials: 'So' },
  { match: /next/i, bg: '#00FF5F', fg: '#000000', initials: 'Nx' },
  { match: /will/i, bg: '#00C2FF', fg: '#FFFFFF', initials: 'Wi' },
  { match: /neon/i, bg: '#11D3D7', fg: '#FFFFFF', initials: 'Ne' },
];

const FALLBACK_PALETTE = [
  { bg: '#22C55E', fg: '#FFFFFF' },
  { bg: '#3B82F6', fg: '#FFFFFF' },
  { bg: '#8B5CF6', fg: '#FFFFFF' },
  { bg: '#EC4899', fg: '#FFFFFF' },
  { bg: '#F59E0B', fg: '#0A0A0C' },
  { bg: '#10B981', fg: '#FFFFFF' },
  { bg: '#06B6D4', fg: '#FFFFFF' },
];

function pickFallback(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
}

function getInitials(name: string): string {
  const tokens = name.replace(/[^a-zA-Z\sçãõéíóáú]/g, ' ').trim().split(/\s+/);
  if (tokens.length >= 2) return (tokens[0][0] + tokens[1][0]).toUpperCase();
  if (tokens.length === 1 && tokens[0].length >= 2) return tokens[0].slice(0, 2).toUpperCase();
  return '??';
}

// Squircle estilo ícone de app iOS — cantos arredondados, não círculo.
const squircleRadius = (size: number) => Math.round(size * 0.28);

export function BankBadge({ bankName, logoUrl, size = 40 }: Props) {
  const name = (bankName ?? '').trim();
  const radius = squircleRadius(size);
  const needsPadding = PADDED_FILL.some((re) => re.test(name));

  if (logoUrl) {
    const safeUrl = toRenderableImageUrl(logoUrl, size);
    if (needsPadding) {
      // Logo com respiro: padding interno + fundo branco. Pra bancos cujo
      // SVG cola nas bordas (Mercado Pago).
      const innerPad = Math.round(size * 0.12);
      const innerSize = size - innerPad * 2;
      return (
        <View style={[styles.box, { width: size, height: size, borderRadius: radius, overflow: 'hidden', backgroundColor: '#FFFFFF', padding: innerPad }]}>
          <Image
            source={{ uri: safeUrl }}
            style={{ width: innerSize, height: innerSize }}
            resizeMode="contain"
          />
        </View>
      );
    }
    // Padrão: logo cobre todo o squircle, sem padding.
    return (
      <View style={[styles.box, { width: size, height: size, borderRadius: radius, overflow: 'hidden', backgroundColor: '#FFFFFF' }]}>
        <Image
          source={{ uri: safeUrl }}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      </View>
    );
  }

  if (!name) {
    return (
      <View style={[styles.box, { width: size, height: size, borderRadius: radius, backgroundColor: '#E5E7EB' }]}>
        <Ionicons name="business-outline" size={Math.round(size * 0.5)} color="#6B7280" />
      </View>
    );
  }

  // Fallback: sem logo, mostra iniciais sobre fundo da marca.
  const preset = BANK_COLORS.find((b) => b.match.test(name));
  const palette = preset ?? pickFallback(name);
  const initials = preset?.initials ?? getInitials(name);

  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: radius, backgroundColor: palette.bg }]}>
      <Text style={[styles.initials, { color: palette.fg, fontSize: Math.round(size * 0.36) }]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  image: { resizeMode: 'cover', backgroundColor: '#E5E7EB' },
  initials: { fontWeight: '900', letterSpacing: -0.5 },
});
