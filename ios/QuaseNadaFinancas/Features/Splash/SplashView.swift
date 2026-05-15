import SwiftUI

struct SplashView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [.brandPrimary, .brandPrimaryAction],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 16) {
                Image(systemName: "leaf.circle.fill")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 96, height: 96)
                    .foregroundColor(.white)
                Text("Quase Nada Finanças")
                    .font(.title2.bold())
                    .foregroundColor(.white)
                ProgressView().tint(.white).padding(.top, 8)
            }
        }
        .task {
            await bootstrap()
        }
    }

    /// Verifica token e tenta hidratar usuário; em caso de falha vai para LoginView.
    private func bootstrap() async {
        // Liga o APIClient ao AppState para refresh/logout automáticos.
        await APIClient.shared.bind(appState: appState)

        guard KeychainManager.shared.loadTokens() != nil else {
            appState.authStatus = .unauthenticated
            return
        }

        do {
            let user: User = try await APIClient.shared.get(Endpoints.me)
            appState.setAuthenticated(user: user)
        } catch {
            // Se falhou, APIClient já tentou refresh; logout total.
            appState.forceLogout()
        }
    }
}
