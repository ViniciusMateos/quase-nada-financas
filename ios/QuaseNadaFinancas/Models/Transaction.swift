import Foundation

struct Transaction: Codable, Identifiable, Equatable {
    let id: String
    let accountId: String
    let accountName: String?
    let date: Date
    let description: String
    let amount: Decimal      // positivo = receita, negativo = despesa
    let currency: String
    let categoryId: String?
    let categoryName: String?
    let categoryIcon: String?
    let pending: Bool
}

/// Resposta paginada por cursor.
struct TransactionsPage: Codable {
    let items: [Transaction]
    let nextCursor: String?
}
