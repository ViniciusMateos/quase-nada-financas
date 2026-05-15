import Foundation
import Security

/// Gerenciador de tokens JWT no Keychain.
/// Usa `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` — não migra entre devices.
final class KeychainManager {

    static let shared = KeychainManager()
    private init() {}

    private let service = "app.quasenada.financas.tokens"
    private let accessTokenKey = "accessToken"
    private let refreshTokenKey = "refreshToken"

    enum KeychainError: Error {
        case unhandled(OSStatus)
        case decodingFailed
    }

    // MARK: - Public API

    func saveTokens(_ tokens: AuthTokens) throws {
        try save(value: tokens.accessToken, key: accessTokenKey)
        try save(value: tokens.refreshToken, key: refreshTokenKey)
    }

    func loadTokens() -> AuthTokens? {
        guard
            let access = try? load(key: accessTokenKey),
            let refresh = try? load(key: refreshTokenKey)
        else { return nil }
        return AuthTokens(accessToken: access, refreshToken: refresh)
    }

    func deleteTokens() throws {
        try delete(key: accessTokenKey)
        try delete(key: refreshTokenKey)
    }

    // MARK: - Internals

    private func save(value: String, key: String) throws {
        guard let data = value.data(using: .utf8) else { throw KeychainError.decodingFailed }

        // Apaga qualquer item anterior antes de inserir (idempotente).
        try? delete(key: key)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]

        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else { throw KeychainError.unhandled(status) }
    }

    private func load(key: String) throws -> String {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess else { throw KeychainError.unhandled(status) }
        guard let data = result as? Data, let str = String(data: data, encoding: .utf8) else {
            throw KeychainError.decodingFailed
        }
        return str
    }

    private func delete(key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.unhandled(status)
        }
    }
}
