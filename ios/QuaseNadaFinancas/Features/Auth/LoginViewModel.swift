import Foundation
import SwiftUI

@MainActor
final class LoginViewModel: ObservableObject {
    @Published var email: String = ""
    @Published var password: String = ""
    @Published var isLoading: Bool = false
    @Published var emailError: String?
    @Published var passwordError: String?
    @Published var formError: String?

    func validate() -> Bool {
        emailError = nil
        passwordError = nil
        formError = nil
        var ok = true
        if email.trimmingCharacters(in: .whitespaces).isEmpty || !email.contains("@") {
            emailError = "Informe um e-mail válido."
            ok = false
        }
        if password.count < 8 {
            passwordError = "Senha precisa ter ao menos 8 caracteres."
            ok = false
        }
        return ok
    }

    func login(appState: AppState) async {
        guard validate() else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            let res = try await AuthService.login(email: email, password: password)
            try KeychainManager.shared.saveTokens(res.tokens)
            appState.setAuthenticated(user: res.user)
        } catch let err as APIError {
            formError = err.errorDescription
        } catch {
            formError = "Não foi possível entrar agora."
        }
    }
}
