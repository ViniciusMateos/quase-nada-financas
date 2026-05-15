import Foundation

struct Category: Codable, Identifiable, Equatable, Hashable {
    let id: String
    let name: String
    let icon: String          // SF Symbol name
    let colorHex: String?     // ex.: "#16A34A"
    let kind: String          // "expense", "income", "transfer"
}
