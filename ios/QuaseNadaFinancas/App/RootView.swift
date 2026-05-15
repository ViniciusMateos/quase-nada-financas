import SwiftUI

/// Decide qual fluxo apresentar com base no AuthStatus global.
struct RootView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        Group {
            switch appState.authStatus {
            case .checking:
                SplashView()
            case .authenticated:
                MainTabView()
            case .unauthenticated:
                LoginView()
            }
        }
        .animation(.easeInOut(duration: 0.25), value: appState.authStatus)
    }
}
