import SwiftUI

struct NewOrderSheet: View {
    let onCompleted: (InvestmentOrder) -> Void

    @Environment(\.dismiss) private var dismiss

    // MVP: símbolos suportados (poderia vir do backend).
    private let symbols = ["BTC", "ETH", "USDT", "BNB", "SOL"]

    @State private var selectedSymbol = "BTC"
    @State private var amountText = ""
    @State private var quote: BinanceQuote?
    @State private var quoteError: String?
    @State private var isSubmitting = false
    @State private var submitError: String?
    @State private var pollTask: Task<Void, Never>?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    symbolPicker
                    amountField
                    quoteCard
                    preview
                    if let submitError {
                        Text(submitError).font(.subheadline).foregroundColor(.brandError)
                    }
                    PrimaryButton(
                        title: "Confirmar com Face ID",
                        icon: "faceid",
                        isLoading: isSubmitting,
                        isDisabled: !canSubmit
                    ) {
                        Task { await submit() }
                    }
                }
                .padding(20)
            }
            .background(Color.brandBackground.ignoresSafeArea())
            .navigationTitle("Nova compra")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancelar") { dismiss() }
                }
            }
            .onAppear { startPolling() }
            .onDisappear { stopPolling() }
            .onChange(of: selectedSymbol) { _, _ in
                quote = nil
                restartPolling()
            }
        }
    }

    private var symbolPicker: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Ativo").font(.subheadline).foregroundColor(.brandTextSecondary)
            Picker("Ativo", selection: $selectedSymbol) {
                ForEach(symbols, id: \.self) { sym in
                    Text(sym).tag(sym)
                }
            }
            .pickerStyle(.segmented)
        }
    }

    private var amountField: some View {
        BrandTextField(
            title: "Valor em BRL",
            text: $amountText,
            keyboardType: .decimalPad
        )
    }

    private var quoteCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Cotação atual").font(.caption).foregroundColor(.brandTextSecondary)
            if let q = quote {
                Text(q.priceBRL.formattedBRL())
                    .font(.title3.bold())
                    .foregroundColor(.brandTextPrimary)
                Text("Atualizada \(q.timestamp.formattedDateTime())")
                    .font(.caption2).foregroundColor(.brandTextSecondary)
            } else if let err = quoteError {
                Text(err).font(.caption).foregroundColor(.brandError)
            } else {
                ProgressView().tint(.brandPrimaryAction)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var preview: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Você receberá aproximadamente")
                .font(.caption).foregroundColor(.brandTextSecondary)
            Text(estimatedAmountText)
                .font(.headline)
                .foregroundColor(.brandTextPrimary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.brandPrimaryTint)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var estimatedAmountText: String {
        guard
            let amount = parsedAmount(),
            let q = quote,
            q.priceBRL > 0
        else { return "—" }
        let qty = amount / q.priceBRL
        return "\(qty.formattedCrypto()) \(selectedSymbol)"
    }

    private var canSubmit: Bool {
        guard let amount = parsedAmount(), amount > 0, quote != nil, !isSubmitting else {
            return false
        }
        return true
    }

    private func parsedAmount() -> Decimal? {
        let normalized = amountText.replacingOccurrences(of: ",", with: ".")
        return Decimal(string: normalized)
    }

    // MARK: - Polling de cotação a cada 5s

    private func startPolling() {
        stopPolling()
        pollTask = Task {
            while !Task.isCancelled {
                await fetchQuote()
                try? await Task.sleep(nanoseconds: 5 * 1_000_000_000)
            }
        }
    }

    private func restartPolling() {
        stopPolling()
        startPolling()
    }

    private func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    private func fetchQuote() async {
        do {
            let q = try await InvestmentsService.quote(symbol: selectedSymbol)
            await MainActor.run {
                self.quote = q
                self.quoteError = nil
            }
        } catch {
            await MainActor.run {
                self.quoteError = "Não foi possível obter a cotação."
            }
        }
    }

    // MARK: - Submissão (FaceID + challenge)

    private func submit() async {
        guard let amount = parsedAmount() else { return }
        isSubmitting = true
        submitError = nil
        defer { isSubmitting = false }

        do {
            // 1) Solicita challenge token efêmero (60s).
            let challenge = try await AuthService.biometricChallenge()
            // 2) FaceID confirma a intenção localmente.
            try await BiometricAuth.authenticate(reason: "Confirme sua compra com Face ID")
            // 3) Submete a ordem com o challenge token no body.
            let order = try await InvestmentsService.placeOrder(
                CreateOrderRequest(
                    symbol: selectedSymbol,
                    side: .buy,
                    amountBRL: amount,
                    challengeToken: challenge.challengeToken
                )
            )
            stopPolling()
            onCompleted(order)
        } catch let err as BiometricAuth.BiometricError {
            submitError = err.errorDescription
        } catch let err as APIError {
            submitError = err.errorDescription
        } catch {
            submitError = "Não foi possível concluir a ordem."
        }
    }
}
