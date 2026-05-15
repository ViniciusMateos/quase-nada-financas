import SwiftUI

struct ConnectBinanceView: View {
    let onComplete: (Bool) -> Void

    @State private var apiKey: String = ""
    @State private var apiSecret: String = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {

                    securityNotice

                    BrandTextField(
                        title: "API Key",
                        text: $apiKey,
                        autocapitalization: .never
                    )

                    SecureFieldWithToggle(
                        title: "API Secret",
                        text: $apiSecret
                    )

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.subheadline)
                            .foregroundColor(.brandError)
                    }

                    PrimaryButton(
                        title: "Conectar",
                        isLoading: isLoading,
                        isDisabled: apiKey.isEmpty || apiSecret.isEmpty
                    ) {
                        Task { await connect() }
                    }
                }
                .padding(20)
            }
            .background(Color.brandBackground.ignoresSafeArea())
            .navigationTitle("Conectar Binance")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancelar") { onComplete(false) }
                }
            }
        }
    }

    private var securityNotice: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "shield.lefthalf.filled")
                    .foregroundColor(.brandPrimaryAction)
                Text("Sua chave fica criptografada")
                    .font(.subheadline.bold())
                    .foregroundColor(.brandTextPrimary)
            }
            Text("Recomendamos criar uma chave Binance com permissões apenas de leitura e trading spot, sem permissão de saque.")
                .font(.caption)
                .foregroundColor(.brandTextSecondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.brandPrimaryTint)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func connect() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            try await InvestmentsService.connect(apiKey: apiKey, apiSecret: apiSecret)
            onComplete(true)
        } catch let err as APIError {
            errorMessage = err.errorDescription
        } catch {
            errorMessage = "Não foi possível conectar agora."
        }
    }
}
