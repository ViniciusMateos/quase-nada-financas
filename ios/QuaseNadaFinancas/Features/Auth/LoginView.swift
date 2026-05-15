import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var vm = LoginViewModel()

    var body: some View {
        ZStack {
            Color.brandBackground.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    header

                    BrandTextField(
                        title: "E-mail",
                        text: $vm.email,
                        keyboardType: .emailAddress,
                        textContentType: .emailAddress,
                        errorMessage: vm.emailError
                    )

                    SecureFieldWithToggle(
                        title: "Senha",
                        text: $vm.password,
                        errorMessage: vm.passwordError
                    )

                    if let formError = vm.formError {
                        Text(formError)
                            .font(.subheadline)
                            .foregroundColor(.brandError)
                    }

                    PrimaryButton(
                        title: "Entrar",
                        isLoading: vm.isLoading
                    ) {
                        Task { await vm.login(appState: appState) }
                    }
                    .padding(.top, 4)

                    HStack {
                        Spacer()
                        Button("Esqueci minha senha") {}
                            .font(.subheadline)
                            .foregroundColor(.brandPrimaryAction)
                        Spacer()
                    }
                }
                .padding(24)
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: "leaf.circle.fill")
                .font(.system(size: 48))
                .foregroundColor(.brandPrimaryAction)
            Text("Bem-vindo de volta")
                .font(.largeTitle.bold())
                .foregroundColor(.brandTextPrimary)
            Text("Acesse sua conta Quase Nada Finanças")
                .font(.subheadline)
                .foregroundColor(.brandTextSecondary)
        }
        .padding(.bottom, 8)
    }
}
