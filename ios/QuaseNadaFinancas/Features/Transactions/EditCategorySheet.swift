import SwiftUI

struct EditCategorySheet: View {
    let currentCategoryId: String?
    let onSelect: (Category) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var categories: [Category] = []
    @State private var state: ViewState<[Category]> = .idle

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 12), count: 4)

    var body: some View {
        NavigationStack {
            Group {
                switch state {
                case .idle, .loading:
                    ProgressView().tint(.brandPrimaryAction)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                case .error(let msg):
                    ErrorStateView(message: msg) { Task { await load() } }
                case .empty:
                    EmptyStateView(icon: "tag", title: "Sem categorias", subtitle: "Tente novamente mais tarde.")
                case .loaded(let cats):
                    ScrollView {
                        LazyVGrid(columns: columns, spacing: 16) {
                            ForEach(cats) { cat in
                                Button {
                                    onSelect(cat)
                                } label: {
                                    CategoryBadge(category: cat, isSelected: cat.id == currentCategoryId)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(20)
                    }
                }
            }
            .navigationTitle("Categoria")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fechar") { dismiss() }
                }
            }
            .task { await load() }
        }
    }

    private func load() async {
        state = .loading
        do {
            let list = try await TransactionsService.categories()
            state = list.isEmpty ? .empty : .loaded(list)
        } catch let err as APIError {
            state = .error(err.errorDescription ?? "Erro inesperado")
        } catch {
            state = .error(error.localizedDescription)
        }
    }
}
