import SwiftUI
import LocalAuthentication

struct SettingsView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var vm = SettingsViewModel()

    var body: some View {
        NavigationStack {
            List {
                Section("Conta") {
                    if let user = appState.currentUser {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(user.name ?? user.email)
                                .font(.headline)
                                .foregroundColor(.brandTextPrimary)
                            Text(user.email)
                                .font(.caption)
                                .foregroundColor(.brandTextSecondary)
                        }
                        .padding(.vertical, 4)
                    }
                }

                Section("Conexões") {
                    NavigationLink("Bancos conectados") { AccountsView() }
                    NavigationLink("Binance") { InvestmentsView() }
                }

                Section("Segurança") {
                    Toggle(isOn: Binding(
                        get: { vm.biometricEnabled },
                        set: { vm.toggleBiometric($0) }
                    )) {
                        Label(biometryLabel, systemImage: biometryIcon)
                    }
                    .tint(.brandPrimaryAction)
                }

                Section {
                    Button(role: .destructive) {
                        Task { await vm.logout(appState: appState) }
                    } label: {
                        if vm.isLoggingOut {
                            ProgressView()
                        } else {
                            Text("Sair da conta")
                        }
                    }
                }

                Section {
                    HStack {
                        Text("Versão")
                        Spacer()
                        Text(appVersion).foregroundColor(.brandTextSecondary)
                    }
                }
            }
            .navigationTitle("Configurações")
        }
    }

    private var biometryLabel: String {
        switch BiometricAuth.availableType() {
        case .faceID: return "Exigir Face ID em ordens"
        case .touchID: return "Exigir Touch ID em ordens"
        default: return "Biometria indisponível"
        }
    }

    private var biometryIcon: String {
        switch BiometricAuth.availableType() {
        case .faceID: return "faceid"
        case .touchID: return "touchid"
        default: return "lock"
        }
    }

    private var appVersion: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }
}
