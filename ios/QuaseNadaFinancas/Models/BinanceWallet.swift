import Foundation

struct BinanceWallet: Codable, Equatable {
    struct Asset: Codable, Identifiable, Equatable {
        var id: String { symbol }
        let symbol: String         // "BTC"
        let name: String?          // "Bitcoin"
        let amount: Decimal        // quantidade do ativo
        let amountBRL: Decimal     // valor convertido em BRL
        let priceBRL: Decimal      // preço atual
    }

    let totalBRL: Decimal
    let assets: [Asset]
    let updatedAt: Date
}
