import Foundation
import SwiftUI
import SwiftData

@MainActor
final class AccountsViewModel: ObservableObject {
    @Published var state: ViewState<[Account]> = .idle
    @Published var showingConnectSheet = false

    // RC-05: modelContext injetado pela View para leitura do cache offline
    var modelContext: ModelContext?

    func load() async {
        state = .loading
        do {
            let accounts = try await AccountsService.list()
            if accounts.isEmpty { state = .empty } else { state = .loaded(accounts) }
        } catch {
            // Falha de rede: tentar cache SwiftData antes de exibir erro
            let cached = loadCachedAccounts()
            if !cached.isEmpty {
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
            let accounts = try await AccountsService.list(forceSync: true)
            if accounts.isEmpty { state = .empty } else { state = .loaded(accounts) }
        } catch {
            // mantém estado anterior visível durante refresh manual
        }
    }

    func delete(_ account: Account) async {
        do {
            try await AccountsService.delete(accountId: account.id)
            await load()
        } catch {
            // exibir erro futuramente em toast
        }
    }

    private func loadCachedAccounts() -> [Account] {
        guard let ctx = modelContext else { return [] }
        let descriptor = FetchDescriptor<CachedAccount>()
        let cached = (try? ctx.fetch(descriptor)) ?? []
        return cached.map { $0.toAccount() }
    }
}
