import Foundation

struct Dashboard: Codable, Equatable {
    struct CategorySummary: Codable, Identifiable, Equatable {
        var id: String { categoryId }
        let categoryId: String
        let categoryName: String
        let categoryIcon: String?
        let total: Decimal
        let percentage: Double  // 0..1
    }

    let month: String                  // "2026-05"
    let totalBalance: Decimal
    let monthlyIncome: Decimal
    let monthlyExpenses: Decimal
    let topCategories: [CategorySummary]
    let recentTransactions: [Transaction]
}
