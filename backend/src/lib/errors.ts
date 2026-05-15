export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = "AppError";
  }
}

export const Errors = {
  Unauthorized: (msg = "Não autorizado") => new AppError("UNAUTHORIZED", msg, 401),
  Forbidden: (msg = "Acesso negado") => new AppError("FORBIDDEN", msg, 403),
  NotFound: (msg = "Recurso não encontrado") => new AppError("NOT_FOUND", msg, 404),
  Conflict: (msg = "Conflito") => new AppError("CONFLICT", msg, 409),
  Validation: (msg: string) => new AppError("VALIDATION_ERROR", msg, 400),
  TooManyRequests: (msg = "Muitas requisições") => new AppError("RATE_LIMITED", msg, 429),
  Internal: (msg = "Erro interno") => new AppError("INTERNAL_SERVER_ERROR", msg, 500),
  ExternalService: (msg: string) => new AppError("EXTERNAL_SERVICE_ERROR", msg, 502),
  InvalidCredentials: () => new AppError("INVALID_CREDENTIALS", "Email ou senha inválidos", 401),
  InvalidBiometric: () => new AppError("INVALID_BIOMETRIC", "Biometria inválida ou expirada", 401),
};
