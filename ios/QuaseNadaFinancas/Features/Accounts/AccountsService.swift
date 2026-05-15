import Foundation

struct AccountsService {

    static func list(forceSync: Bool = false) async throws -> [Account] {
        try await APIClient.shared.get(
            Endpoints.accounts,
            query: ["forceSync": forceSync ? "true" : nil]
        )
    }

    static func sync(accountId: String) async throws -> Account {
        try await APIClient.shared.post(Endpoints.accountSync(accountId))
    }

    static func delete(accountId: String) async throws {
        let _: EmptyResponse = try await APIClient.shared.delete(Endpoints.account(accountId))
    }

    struct PluggyConnectToken: Decodable {
        let connectToken: String
        let expiresAt: Date?
    }

    static func pluggyConnectToken() async throws -> PluggyConnectToken {
        try await APIClient.shared.post(Endpoints.pluggyConnectToken)
    }

    struct PluggyCallbackBody: Encodable {
        let itemId: String
    }

    static func pluggyCallback(itemId: String) async throws {
        let _: EmptyResponse = try await APIClient.shared.post(
            Endpoints.pluggyCallback,
            body: PluggyCallbackBody(itemId: itemId)
        )
    }
}
