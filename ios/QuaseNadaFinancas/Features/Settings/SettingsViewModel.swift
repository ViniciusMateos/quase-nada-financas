import Foundation
import SwiftUI

@MainActor
final class SettingsViewModel: ObservableObject {
    @Published var biometricEnabled: Bool = UserDefaults.standard.bool(forKey: "biometric_enabled")
    @Published var isLoggingOut = false
    @Published var errorMessage: String?

    func toggleBiometric(_ enabled: Bool) {
        biometricEnabled = enabled
        UserDefaults.standard.set(enabled, forKey: "biometric_enabled")
    }

    func logout(appState: AppState) async {
        isLoggingOut = true
        defer { isLoggingOut = false }
        do {
            try await AuthService.logout()
        } catch {
            // mesmo se falhar no servidor, deslogamos localmente
        }
        appState.forceLogout()
    }
}
