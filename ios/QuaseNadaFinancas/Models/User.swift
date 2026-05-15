import Foundation

struct User: Codable, Identifiable, Equatable {
    let id: String
    let email: String
    let name: String?
    let createdAt: Date
}
