import Foundation

struct TransactionsService {

    static func list(
        cursor: String? = nil,
        limit: Int = 30,
        accountId: String? = nil,
        startDate: Date? = nil,
        endDate: Date? = nil,
        categoryId: String? = nil
    ) async throws -> TransactionsPage {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]

        return try await APIClient.shared.get(
            Endpoints.transactions,
            query: [
                "cursor": cursor,
                "limit": String(limit),
                "accountId": accountId,
                "startDate": startDate.map { iso.string(from: $0) },
                "endDate": endDate.map { iso.string(from: $0) },
                "categoryId": categoryId
            ]
        )
    }

    struct UpdateCategoryBody: Encodable {
        let categoryId: String
    }

    static func updateCategory(transactionId: String, categoryId: String) async throws -> Transaction {
        try await APIClient.shared.patch(
            Endpoints.transactionCategory(transactionId),
            body: UpdateCategoryBody(categoryId: categoryId)
        )
    }

    static func categories() async throws -> [Category] {
        try await APIClient.shared.get(Endpoints.categories)
    }
}
