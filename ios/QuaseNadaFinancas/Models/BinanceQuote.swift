import Foundation

struct BinanceQuote: Codable, Equatable {
    let symbol: String
    let priceBRL: Decimal
    let priceUSDT: Decimal?
    let timestamp: Date
}
