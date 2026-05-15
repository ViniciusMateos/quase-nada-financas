import Foundation

/// Constantes de paths — sempre relativos a `AppConfig.apiBaseURL`.
enum Endpoints {

    // Auth
    static let register = "/auth/register"
    static let login = "/auth/login"
    static let refresh = "/auth/refresh"
    static let logout = "/auth/logout"
    static let me = "/auth/me"
    static let biometricChallenge = "/auth/biometric-challenge"

    // Pluggy
    static let pluggyConnectToken = "/pluggy/connect-token"
    static let pluggyCallback = "/pluggy/callback"

    // Accounts
    static let accounts = "/accounts"
    static func account(_ id: String) -> String { "/accounts/\(id)" }
    static func accountSync(_ id: String) -> String { "/accounts/\(id)/sync" }

    // Transactions
    static let transactions = "/transactions"
    static func transactionCategory(_ id: String) -> String { "/transactions/\(id)/category" }

    // Categories
    static let categories = "/categories"

    // Dashboard
    static let dashboard = "/dashboard"

    // Binance
    static let binanceConnect = "/binance/connect"
    static let binanceWallet = "/binance/wallet"
    static func binanceQuote(_ symbol: String) -> String { "/binance/quote/\(symbol)" }
    static let binanceOrders = "/binance/orders"
}
