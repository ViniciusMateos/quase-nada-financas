import SwiftUI

struct TransactionsView: View {
    @StateObject private var vm: TransactionsViewModel

    init(initialAccountId: String? = nil) {
        _vm = StateObject(wrappedValue: TransactionsViewModel(initialAccountId: initialAccountId))
    }

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Transações")
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            vm.showingFilters = true
                        } label: {
                            Image(systemName: "line.3.horizontal.decrease.circle")
                                .foregroundColor(.brandPrimaryAction)
                        }
                        .accessibilityLabel("Filtros")
                    }
                }
                .background(Color.brandBackground.ignoresSafeArea())
                .task { if case .idle = vm.state { await vm.loadInitial() } }
                .refreshable { await vm.refresh() }
                .sheet(isPresented: $vm.showingFilters) {
                    TransactionFiltersSheet(viewModel: vm)
                        .presentationDetents([.medium, .large])
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
            ErrorStateView(message: msg) { Task { await vm.loadInitial() } }
        case .empty:
            EmptyStateView(
                icon: "list.bullet.rectangle",
                title: "Sem transações",
                subtitle: "Quando seu banco sincronizar, suas transações aparecerão aqui."
            )
        case .loaded:
            list
        }
    }

    private var list: some View {
        List {
            ForEach(vm.transactions) { tx in
                NavigationLink {
                    TransactionDetailView(transaction: tx) { updated in
                        vm.updateLocalCategory(
                            transactionId: tx.id,
                            category: Category(
                                id: updated.id,
                                name: updated.name,
                                icon: updated.icon,
                                colorHex: updated.colorHex,
                                kind: updated.kind
                            )
                        )
                    }
                } label: {
                    TransactionRowView(transaction: tx)
                }
                .listRowBackground(Color.white)
                .task {
                    await vm.loadMoreIfNeeded(currentItem: tx)
                }
            }
            if vm.isFetchingMore {
                HStack {
                    Spacer(); ProgressView().tint(.brandPrimaryAction); Spacer()
                }
                .listRowBackground(Color.brandBackground)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
    }
}
