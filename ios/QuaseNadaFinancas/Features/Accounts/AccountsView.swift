import SwiftUI

struct AccountsView: View {
    @StateObject private var vm = AccountsViewModel()
    @Environment(\.modelContext) private var modelContext // RC-05

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Contas")
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            vm.showingConnectSheet = true
                        } label: {
                            Image(systemName: "plus.circle.fill")
                                .foregroundColor(.brandPrimaryAction)
                        }
                        .accessibilityLabel("Conectar banco")
                    }
                }
                .background(Color.brandBackground.ignoresSafeArea())
                .task {
                    vm.modelContext = modelContext // RC-05
                    if case .idle = vm.state { await vm.load() }
                }
                .refreshable { await vm.refresh() }
                .sheet(isPresented: $vm.showingConnectSheet) {
                    ConnectBankView { didConnect in
                        vm.showingConnectSheet = false
                        if didConnect { Task { await vm.load() } }
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
                icon: "creditcard",
                title: "Nenhuma conta conectada",
                subtitle: "Conecte seu primeiro banco para começar a acompanhar suas finanças.",
                actionTitle: "Conectar banco"
            ) {
                vm.showingConnectSheet = true
            }
        case .loaded(let accounts):
            ScrollView {
                VStack(spacing: 12) {
                    ForEach(accounts) { account in
                        NavigationLink {
                            TransactionsView(initialAccountId: account.id)
                        } label: {
                            AccountCard(account: account)
                        }
                        .swipeActions {
                            Button(role: .destructive) {
                                Task { await vm.delete(account) }
                            } label: {
                                Label("Remover", systemImage: "trash")
                            }
                        }
                    }
                }
                .padding(16)
            }
        }
    }
}
