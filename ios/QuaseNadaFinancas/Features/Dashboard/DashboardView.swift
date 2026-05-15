import SwiftUI

struct DashboardView: View {
    @StateObject private var vm = DashboardViewModel()
    @Environment(\.modelContext) private var modelContext // RC-05

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Início")
                .background(Color.brandBackground.ignoresSafeArea())
                .task {
                    vm.modelContext = modelContext // RC-05: injeta contexto offline
                    if case .idle = vm.state { await vm.load() }
                }
                .refreshable { await vm.refresh() }
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
                icon: "tray",
                title: "Sem dados ainda",
                subtitle: "Conecte sua primeira conta para começar."
            )
        case .loaded(let dash):
            loaded(dash)
        }
    }

    private func loaded(_ dash: Dashboard) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                balanceCard(dash)
                monthSummary(dash)
                topCategories(dash)
                recentTransactions(dash)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
    }

    private func balanceCard(_ dash: Dashboard) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Saldo total")
                .font(.subheadline).foregroundColor(.white.opacity(0.85))
            Text(dash.totalBalance.formattedBRL())
                .font(.largeTitle.bold())
                .foregroundColor(.white)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(
            LinearGradient(
                colors: [.brandPrimary, .brandPrimaryAction],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func monthSummary(_ dash: Dashboard) -> some View {
        HStack(spacing: 12) {
            summaryTile(
                title: "Receitas",
                value: dash.monthlyIncome,
                icon: "arrow.down.circle.fill",
                color: .brandSuccess
            )
            summaryTile(
                title: "Despesas",
                value: dash.monthlyExpenses,
                icon: "arrow.up.circle.fill",
                color: .brandError
            )
        }
    }

    private func summaryTile(title: String, value: Decimal, icon: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon).foregroundColor(color)
                Text(title).font(.caption).foregroundColor(.brandTextSecondary)
            }
            Text(value.formattedBRL())
                .font(.headline)
                .foregroundColor(.brandTextPrimary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func topCategories(_ dash: Dashboard) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Top categorias do mês")
                .font(.headline)
                .foregroundColor(.brandTextPrimary)

            // Placeholder de gráfico — Swift Charts entra na v1.1.
            VStack(spacing: 10) {
                ForEach(dash.topCategories.prefix(5)) { cat in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Image(systemName: cat.categoryIcon ?? "tag.fill")
                                .foregroundColor(.brandPrimaryAction)
                            Text(cat.categoryName)
                                .font(.subheadline)
                                .foregroundColor(.brandTextPrimary)
                            Spacer()
                            Text(cat.total.formattedBRL())
                                .font(.subheadline.weight(.semibold))
                                .foregroundColor(.brandTextPrimary)
                        }
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Color.brandPrimaryTint).frame(height: 8)
                                Capsule()
                                    .fill(Color.brandPrimaryAction)
                                    .frame(width: geo.size.width * cat.percentage, height: 8)
                            }
                        }
                        .frame(height: 8)
                    }
                }
            }
            .padding(14)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }

    private func recentTransactions(_ dash: Dashboard) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Últimas transações")
                    .font(.headline)
                    .foregroundColor(.brandTextPrimary)
                Spacer()
                NavigationLink("Ver todas") { TransactionsView() }
                    .font(.subheadline)
                    .foregroundColor(.brandPrimaryAction)
            }
            VStack(spacing: 0) {
                ForEach(dash.recentTransactions.prefix(5)) { tx in
                    NavigationLink {
                        TransactionDetailView(transaction: tx)
                    } label: {
                        TransactionCard(transaction: tx)
                    }
                    Divider().padding(.leading, 52)
                }
            }
            .padding(.horizontal, 14)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }
}
