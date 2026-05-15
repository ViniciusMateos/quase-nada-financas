import SwiftUI
import SwiftData

@main
struct QuaseNadaFinancasApp: App {
    // Estado global compartilhado em toda a árvore de Views.
    @StateObject private var appState = AppState()

    // Container SwiftData para cache offline (transações, contas, dashboard).
    private let modelContainer: ModelContainer = {
        let schema = Schema([
            CachedAccount.self,
            CachedTransaction.self,
            CachedDashboard.self
        ])
        let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        do {
            return try ModelContainer(for: schema, configurations: [configuration])
        } catch {
            fatalError("Falha ao criar ModelContainer: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
                .preferredColorScheme(.light) // MVP: tema claro fixo
        }
        .modelContainer(modelContainer)
    }
}
