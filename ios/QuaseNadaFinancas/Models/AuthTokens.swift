import Foundation

struct AuthTokens: Codable, Equatable {
    let accessToken: String
    let refreshToken: String
}

struct LoginResponse: Codable {
    let user: User
    let accessToken: String
    let refreshToken: String

    var tokens: AuthTokens {
        AuthTokens(accessToken: accessToken, refreshToken: refreshToken)
    }
}

struct BiometricChallengeResponse: Codable {
    let challengeToken: String
    let expiresAt: Date
}
