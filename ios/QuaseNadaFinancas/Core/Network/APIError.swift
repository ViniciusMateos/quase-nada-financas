import Foundation

/// Erros tipados para o front consumir e exibir mensagens amigáveis.
enum APIError: LocalizedError {
    case invalidURL
    case noResponse
    case decoding(Error)
    case transport(Error)
    case unauthorized
    case server(code: String, message: String, statusCode: Int)
    case unknown(statusCode: Int)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "URL inválida."
        case .noResponse: return "Sem resposta do servidor."
        case .decoding: return "Não conseguimos interpretar a resposta do servidor."
        case .transport(let err): return err.localizedDescription
        case .unauthorized: return "Sessão expirada. Faça login novamente."
        case .server(_, let msg, _): return msg
        case .unknown(let code): return "Erro inesperado (\(code))."
        }
    }
}

/// Envelope de erro retornado pelo backend.
struct APIErrorEnvelope: Decodable {
    struct Body: Decodable {
        let code: String
        let message: String
        let statusCode: Int
    }
    let error: Body
}
