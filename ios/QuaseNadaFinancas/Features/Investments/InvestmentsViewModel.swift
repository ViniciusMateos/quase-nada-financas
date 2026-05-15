import Foundation
import SwiftUI

@MainActor
final class InvestmentsViewModel: ObservableObject {
    @Published var state: ViewState<BinanceWallet> = .idle
    @Published var showingConnect = false
    @Published var showingNewOrder = false
    @Published var lastOrderResult: InvestmentOrder?

    func load() async {
        state = .loading
        do {
            let wallet = try await InvestmentsService.wallet()
            state = wallet.assets.isEmpty ? .empty : .loaded(wallet)
        } catch let err as APIError where err.errorDescription?.contains("não conect") == true {
            // Caso especial: backend pode sinalizar Binance não conectada.
            state = .empty
        } catch let err as APIError {
            // 404/403 => assumimos não conectada para mostrar onboarding.
            if case .server(_, _, let status) = err, status == 404 || status == 403 {
                state = .empty
            } else {
                state = .error(err.errorDescription ?? "Erro inesperado")
            }
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    func refresh() async {
        do {
            let wallet = try await InvestmentsService.wallet()
            state = wallet.assets.isEmpty ? .empty : .loaded(wallet)
        } catch {
            // mantém anterior
        }
    }
}
