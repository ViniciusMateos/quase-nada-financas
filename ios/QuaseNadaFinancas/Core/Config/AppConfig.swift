import Foundation

/// Configurações lidas do Info.plist (chaves: API_BASE_URL).
enum AppConfig {
    static var apiBaseURL: URL {
        guard
            let raw = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
            let url = URL(string: raw)
        else {
            // Fallback explícito — produção deve ter sempre a chave.
            return URL(string: "https://api.quasenada.app/api/v1")!
        }
        return url
    }
}
