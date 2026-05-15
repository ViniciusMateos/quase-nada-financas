import SwiftUI

struct InvestmentsView: View {
    @StateObject private var vm = InvestmentsViewModel()

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Investimentos")
                .toolbar {
                    if case .loaded = vm.state {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button {
                                vm.showingNewOrder = true
                            } label: {
                                Image(systemName: "plus.circle.fill")
                                    .foregroundColor(.brandPrimaryAction)
                            }
                            .accessibilityLabel("Nova compra")
                        }
                    }
                }
                .background(Color.brandBackground.ignoresSafeArea())
                .task { if case .idle = vm.state { await vm.load() } }
                .refreshable { await vm.refresh() }
                .sheet(isPresented: $vm.showingConnect) {
                    ConnectBinanceView { didConnect in
                        vm.showingConnect = false
                        if didConnect { Task { await vm.load() } }
                    }
                }
                .sheet(isPresented: $vm.showingNewOrder) {
                    NewOrderSheet { result in
                        vm.lastOrderResult = result
                        vm.showingNewOrder = false
                        Task { await vm.load() }
                    }
                    .presentationDetents([.large])
                }
                .sheet(item: $vm.lastOrderResult) { order in
                    OrderResultView(order: order) {
                        vm.lastOrderResult = nil
                    }
                }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch vm.state {
        case .idle, .loading:
            ProgressView().tint(.brandPrimaryAction)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .error(let msg):
            ErrorStateView(message: msg) { Task { await vm.load() } }
        case .empty:
            EmptyStateView(
                icon: "bitcoinsign.circle",
                title: "Conecte sua Binance",
                subtitle: "Conecte sua carteira Binance para acompanhar seus ativos e investir direto pelo app.",
                actionTitle: "Conectar Binance"
            ) {
                vm.showingConnect = true
            }
        case .loaded(let wallet):
            loaded(wallet)
        }
    }

    private func loaded(_ wallet: BinanceWallet) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Patrimônio Binance")
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.85))
                    Text(wallet.totalBRL.formattedBRL())
                        .font(.largeTitle.bold())
                        .foregroundColor(.white)
                    Text("Atualizado em \(wallet.updatedAt.formattedDateTime())")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.7))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(20)
                .background(
                    LinearGradient(
                        colors: [.brandPrimary, .brandAccent],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

                VStack(alignment: .leading, spacing: 12) {
                    Text("Seus ativos")
                        .font(.headline)
                        .foregroundColor(.brandTextPrimary)
                    VStack(spacing: 0) {
                        ForEach(wallet.assets) { asset in
                            AssetRow(asset: asset)
                            Divider().padding(.leading, 52)
                        }
                    }
                    .padding(.horizontal, 14)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
            }
            .padding(16)
        }
    }
}
