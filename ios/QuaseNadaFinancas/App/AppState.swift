import Foundation
import SwiftUI

/// Estado global de autenticação e usuário corrente.
@MainActor
final class AppState: ObservableObject {

    enum AuthStatus: Equatable {
        case checking      // verificando token no Keychain (splash)
        case authenticated // logado, dentro do app
        case unauthenticated // precisa de login
    }

    @Published var authStatus: AuthStatus = .checking
    @Published var currentUser: User?
    @Published var globalError: String?

    /// Chamado pelo APIClient quando o refresh token também falha.
    func forceLogout(reason: String? = nil) {
        try? KeychainManager.shared.deleteTokens()
        currentUser = nil
        if let reason { globalError = reason }
        authStatus = .unauthenticated
    }

    /// Marca usuário autenticado após login ou refresh bem-sucedido.
    func setAuthenticated(user: User) {
        currentUser = user
        authStatus = .authenticated
    }
}
