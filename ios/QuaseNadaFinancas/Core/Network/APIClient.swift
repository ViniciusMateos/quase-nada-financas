import Foundation

/// Cliente HTTP central. Responsabilidades:
/// - Anexar Bearer token automaticamente.
/// - Decodificar JSON em camelCase com datas ISO8601.
/// - Em 401, tentar refresh **uma única vez** e refazer o request original.
/// - Se refresh falhar, notificar AppState para forçar logout.
actor APIClient {

    static let shared = APIClient()

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder
    private weak var appStateRef: AppState?

    /// Evita múltiplos refreshes concorrentes — todos esperam o mesmo Task.
    private var refreshTask: Task<Bool, Never>?

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config)

        self.decoder = JSONDecoder()
        self.decoder.keyDecodingStrategy = .convertFromSnakeCase
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        self.decoder.dateDecodingStrategy = .custom { dec in
            let container = try dec.singleValueContainer()
            let str = try container.decode(String.self)
            if let d = iso.date(from: str) { return d }
            // Fallback para ISO sem fração de segundos.
            let plain = ISO8601DateFormatter()
            plain.formatOptions = [.withInternetDateTime]
            if let d = plain.date(from: str) { return d }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Data inválida: \(str)")
        }

        self.encoder = JSONEncoder()
        self.encoder.keyEncodingStrategy = .convertToSnakeCase
        self.encoder.dateEncodingStrategy = .iso8601
    }

    // MARK: - Configuração

    func bind(appState: AppState) {
        self.appStateRef = appState
    }

    // MARK: - API Pública

    func get<T: Decodable>(_ path: String, query: [String: String?] = [:]) async throws -> T {
        try await request(path: path, method: "GET", query: query, body: Optional<EmptyBody>.none)
    }

    func post<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        try await request(path: path, method: "POST", query: [:], body: body)
    }

    func post<T: Decodable>(_ path: String) async throws -> T {
        try await request(path: path, method: "POST", query: [:], body: Optional<EmptyBody>.none)
    }

    func put<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        try await request(path: path, method: "PUT", query: [:], body: body)
    }

    func patch<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        try await request(path: path, method: "PATCH", query: [:], body: body)
    }

    func delete<T: Decodable>(_ path: String) async throws -> T {
        try await request(path: path, method: "DELETE", query: [:], body: Optional<EmptyBody>.none)
    }

    // MARK: - Núcleo

    private func request<T: Decodable, B: Encodable>(
        path: String,
        method: String,
        query: [String: String?],
        body: B?,
        isRetry: Bool = false
    ) async throws -> T {
        let url = try buildURL(path: path, query: query)
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")

        if let token = KeychainManager.shared.loadTokens()?.accessToken {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body, !(body is EmptyBody) {
            req.httpBody = try encoder.encode(body)
        }

        let (data, response) = try await performRequest(req)

        guard let http = response as? HTTPURLResponse else { throw APIError.noResponse }

        switch http.statusCode {
        case 200..<300:
            // Endpoints como DELETE podem retornar 204 sem body.
            if data.isEmpty, let empty = EmptyResponse() as? T { return empty }
            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                throw APIError.decoding(error)
            }

        case 401:
            // Tentativa única de refresh.
            if !isRetry, await tryRefreshTokens() {
                return try await self.request(
                    path: path, method: method, query: query, body: body, isRetry: true
                )
            }
            await forceLogout(reason: "Sua sessão expirou.")
            throw APIError.unauthorized

        default:
            if let env = try? decoder.decode(APIErrorEnvelope.self, from: data) {
                throw APIError.server(
                    code: env.error.code,
                    message: env.error.message,
                    statusCode: env.error.statusCode
                )
            }
            throw APIError.unknown(statusCode: http.statusCode)
        }
    }

    private func performRequest(_ req: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await session.data(for: req)
        } catch {
            throw APIError.transport(error)
        }
    }

    private func buildURL(path: String, query: [String: String?]) throws -> URL {
        guard var comps = URLComponents(
            url: AppConfig.apiBaseURL.appendingPathComponent(path),
            resolvingAgainstBaseURL: false
        ) else {
            throw APIError.invalidURL
        }
        let items = query.compactMap { (k, v) -> URLQueryItem? in
            guard let v else { return nil }
            return URLQueryItem(name: k, value: v)
        }
        if !items.isEmpty { comps.queryItems = items }
        guard let url = comps.url else { throw APIError.invalidURL }
        return url
    }

    // MARK: - Refresh coordenado

    private func tryRefreshTokens() async -> Bool {
        if let task = refreshTask { return await task.value }

        let task = Task<Bool, Never> { [weak self] in
            guard let self else { return false }
            return await self.performRefresh()
        }
        refreshTask = task
        let result = await task.value
        refreshTask = nil
        return result
    }

    private func performRefresh() async -> Bool {
        guard let tokens = KeychainManager.shared.loadTokens() else { return false }

        struct RefreshBody: Encodable { let refreshToken: String }
        struct RefreshResponse: Decodable {
            let accessToken: String
            let refreshToken: String
        }

        let url = AppConfig.apiBaseURL.appendingPathComponent(Endpoints.refresh)
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        do {
            req.httpBody = try encoder.encode(RefreshBody(refreshToken: tokens.refreshToken))
            let (data, resp) = try await session.data(for: req)
            guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                return false
            }
            let parsed = try decoder.decode(RefreshResponse.self, from: data)
            try KeychainManager.shared.saveTokens(
                AuthTokens(accessToken: parsed.accessToken, refreshToken: parsed.refreshToken)
            )
            return true
        } catch {
            return false
        }
    }

    private func forceLogout(reason: String) async {
        guard let appState = appStateRef else { return }
        await MainActor.run {
            appState.forceLogout(reason: reason)
        }
    }
}

// MARK: - Helpers

struct EmptyBody: Encodable {}
struct EmptyResponse: Decodable {}
