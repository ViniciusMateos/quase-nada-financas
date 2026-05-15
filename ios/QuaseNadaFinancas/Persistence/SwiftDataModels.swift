import Foundation
import SwiftData

/// Cache offline mínimo. Não substitui a fonte de verdade (API),
/// apenas permite tela inicial sem rede no cold start.
@Model
final class CachedAccount {
    @Attribute(.unique) var id: String
    var name: String
    var institution: String
    var type: String
    var balance: Decimal
    var currency: String
    var lastSyncedAt: Date?

    init(from acc: Account) {
        self.id = acc.id
        self.name = acc.name
        self.institution = acc.institution
        self.type = acc.type
        self.balance = acc.balance
        self.currency = acc.currency
        self.lastSyncedAt = acc.lastSyncedAt
    }

    func toAccount() -> Account {
        Account(
            id: id,
            name: name,
            institution: institution,
            type: type,
            balance: balance,
            currency: currency,
            lastSyncedAt: lastSyncedAt,
            pluggyItemId: nil
        )
    }
}

@Model
final class CachedTransaction {
    @Attribute(.unique) var id: String
    var accountId: String
    var date: Date
    var transactionDescription: String
    var amount: Decimal
    var categoryId: String?
    var categoryName: String?
    var categoryIcon: String?

    init(from tx: Transaction) {
        self.id = tx.id
        self.accountId = tx.accountId
        self.date = tx.date
        self.transactionDescription = tx.description
        self.amount = tx.amount
        self.categoryId = tx.categoryId
        self.categoryName = tx.categoryName
        self.categoryIcon = tx.categoryIcon
    }
}

@Model
final class CachedDashboard {
    @Attribute(.unique) var month: String
    var totalBalance: Decimal
    var monthlyIncome: Decimal
    var monthlyExpenses: Decimal
    var updatedAt: Date
    var savedAt: Date

    init(month: String, totalBalance: Decimal, monthlyIncome: Decimal, monthlyExpenses: Decimal) {
        self.month = month
        self.totalBalance = totalBalance
        self.monthlyIncome = monthlyIncome
        self.monthlyExpenses = monthlyExpenses
        self.updatedAt = .now
        self.savedAt = .now
    }

    func toDashboard() -> Dashboard {
        Dashboard(
            month: month,
            totalBalance: totalBalance,
            monthlyIncome: monthlyIncome,
            monthlyExpenses: monthlyExpenses,
            topCategories: [],
            recentTransactions: []
        )
    }
}
