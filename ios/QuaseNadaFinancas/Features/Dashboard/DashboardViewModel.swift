import Foundation
import SwiftUI
import SwiftData

@MainActor
final class DashboardViewModel: ObservableObject {
    @Published var state: ViewState<Dashboard> = .idle
    @Published var selectedMonth: Date = .now

    // RC-05: modelContext injetado pela View para leitura do cache offline
    var modelContext: ModelContext?

    func load() async {
        state = .loading
        do {
            let dash = try await DashboardService.fetch(month: selectedMonth)
            state = dash.totalBalance == 0 && dash.recentTransactions.isEmpty ? .empty : .loaded(dash)
        } catch {
            // Falha de rede: tentar cache offline antes de exibir erro
            if let cached = loadCachedDashboard() {
                state = .loaded(cached)
            } else if let apiErr = error as? APIError {
                state = .error(apiErr.errorDescription ?? "Erro inesperado")
            } else {
                state = .error("Sem conexão. Verifique sua internet e tente novamente.")
            }
        }
    }

    func refresh() async {
        do {
            let dash = try await DashboardService.fetch(month: selectedMonth)
            state = .loaded(dash)
        } catch {
            // Em refresh manual mantém o estado atual visível; só troca se conseguir dados novos.
        }
    }

    // Lê snapshot do dashboard salvo pelo último sync bem-sucedido
    private func loadCachedDashboard() -> Dashboard? {
        guard let ctx = modelContext else { return nil }
        let descriptor = FetchDescriptor<CachedDashboard>(sortBy: [SortDescriptor(\.savedAt, order: .reverse)])
        guard let cached = try? ctx.fetch(descriptor).first else { return nil }
        return cached.toDashboard()
    }
}
