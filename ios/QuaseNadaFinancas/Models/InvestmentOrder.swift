import Foundation

enum OrderSide: String, Codable {
    case buy
    case sell
}

struct InvestmentOrder: Codable, Identifiable, Equatable {
    let id: String
    let symbol: String
    let side: OrderSide
    let amountBRL: Decimal
    let executedQuantity: Decimal?
    let executedPriceBRL: Decimal?
    let status: String      // "pending", "filled", "failed"
    let createdAt: Date
    let errorMessage: String?
}

struct CreateOrderRequest: Encodable {
    let symbol: String
    let side: OrderSide
    let amountBRL: Decimal
    let challengeToken: String
}
