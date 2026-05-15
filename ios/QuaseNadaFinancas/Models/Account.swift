import Foundation

struct Account: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let institution: String
    let type: String           // "checking", "savings", "credit_card", etc.
    let balance: Decimal
    let currency: String       // "BRL"
    let lastSyncedAt: Date?
    let pluggyItemId: String?
}
