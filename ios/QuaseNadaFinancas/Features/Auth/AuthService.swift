import Foundation

struct AuthService {

    struct LoginBody: Encodable {
        let email: String
        let password: String
    }

    static func login(email: String, password: String) async throws -> LoginResponse {
        try await APIClient.shared.post(
            Endpoints.login,
            body: LoginBody(email: email, password: password)
        )
    }

    static func me() async throws -> User {
        try await APIClient.shared.get(Endpoints.me)
    }

    static func logout() async throws {
        let _: EmptyResponse = try await APIClient.shared.delete(Endpoints.logout)
    }

    static func biometricChallenge() async throws -> BiometricChallengeResponse {
        try await APIClient.shared.post(Endpoints.biometricChallenge)
    }
}
