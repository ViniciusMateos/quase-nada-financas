export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AppError';
  }
}

const messages: Record<string, string> = {
  INVALID_CREDENTIALS: 'Email ou senha incorretos.',
  TOKEN_EXPIRED: 'Sua sessao expirou. Entre novamente.',
  INVALID_REFRESH_TOKEN: 'Sua sessao expirou. Entre novamente.',
  UNAUTHORIZED: 'Entre novamente para continuar.',
  VALIDATION_ERROR: 'Confira os campos destacados.',
  PLUGGY_CONNECT_FAILED: 'Nao foi possivel iniciar a conexao bancaria.',
  ACCOUNT_DELETE_FAILED: 'Nao foi possivel remover a conta.',
  INVALID_CHALLENGE_TOKEN: 'Confirmacao expirada. Tente novamente.',
  INVALID_AMOUNT: 'Digite um valor valido para a ordem.',
  BINANCE_ORDER_FAILED: 'A Binance rejeitou a ordem.',
  RATE_LIMITED: 'Muitas tentativas. Aguarde um pouco.',
  NETWORK_ERROR: 'Sem conexao. Verifique sua internet e tente novamente.'
};

export function normalizeError(error: any): AppError {
  if (error instanceof AppError) return error;
  if (!error.response) return new AppError('NETWORK_ERROR', messages.NETWORK_ERROR);

  const payload = error.response.data?.error;
  const code = payload?.code || (error.response.status === 429 ? 'RATE_LIMITED' : 'UNEXPECTED');
  const message = messages[code] || payload?.message || 'Nao foi possivel concluir a operacao.';
  return new AppError(code, message, error.response.status);
}
