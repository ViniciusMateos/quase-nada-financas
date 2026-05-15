import Foundation

struct InvestmentsService {

    struct ConnectBinanceBody: Encodable {
        let apiKey: String
        let apiSecret: String
    }

    static func connect(apiKey: String, apiSecret: String) async throws {
        let _: EmptyResponse = try await APIClient.shared.post(
            Endpoints.binanceConnect,
            body: ConnectBinanceBody(apiKey: apiKey, apiSecret: apiSecret)
        )
    }

    static func disconnect() async throws {
        let _: EmptyResponse = try await APIClient.shared.delete(Endpoints.binanceConnect)
    }

    static func wallet() async throws -> BinanceWallet {
        try await APIClient.shared.get(Endpoints.binanceWallet)
    }

    static func quote(symbol: String) async throws -> BinanceQuote {
        try await APIClient.shared.get(Endpoints.binanceQuote(symbol))
    }

    static func placeOrder(_ request: CreateOrderRequest) async throws -> InvestmentOrder {
        try await APIClient.shared.post(Endpoints.binanceOrders, body: request)
    }

    static func orders() async throws -> [InvestmentOrder] {
        try await APIClient.shared.get(Endpoints.binanceOrders)
    }
}
