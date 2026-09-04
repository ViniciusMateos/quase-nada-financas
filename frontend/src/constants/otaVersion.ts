// Número da versão OTA do JS.
//
// REGRA DO PROJETO (padrão fixo, igual brechó/lembretes): incrementar +1 a CADA
// `eas update` publicado no canal preview. É este número que aparece no rodapé
// do Ajustes — é a PROVA de que o bundle novo baixou e está rodando: se o device
// ainda mostra o número antigo, o OTA ainda não pegou.
//
// Não confundir com:
//   - `version` (1.0.x) no app.config → versão de marketing
//   - `runtimeVersion` (1.0.0) fixo → compatibilidade OTA×nativo (só muda em build)
export const OTA_VERSION = 19;

// Detecta se o bundle rodando veio de um `eas update` (OTA) ou do JS embutido no
// build. Em dev client o módulo pode se comportar diferente — cai no fallback.
let Updates: { isEmbeddedLaunch?: boolean } | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Updates = require('expo-updates');
} catch {
  Updates = null;
}

export function rodandoDeUpdate(): boolean {
  try {
    return Updates?.isEmbeddedLaunch === false;
  } catch {
    return false;
  }
}
