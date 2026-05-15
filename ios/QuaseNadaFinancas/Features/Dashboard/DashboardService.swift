import Foundation

struct DashboardService {
    static func fetch(month: Date = .now) async throws -> Dashboard {
        try await APIClient.shared.get(
            Endpoints.dashboard,
            query: ["month": month.toMonthQueryString()]
        )
    }
}
