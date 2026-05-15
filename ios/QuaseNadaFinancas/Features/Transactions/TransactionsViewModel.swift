import Foundation
import SwiftUI

@MainActor
final class TransactionsViewModel: ObservableObject {

    @Published var transactions: [Transaction] = []
    @Published var state: ViewState<[Transaction]> = .idle
    @Published var isFetchingMore = false
    @Published var nextCursor: String?
    @Published var showingFilters = false

    // Filtros
    @Published var filterAccountId: String?
    @Published var filterCategoryId: String?
    @Published var filterStartDate: Date?
    @Published var filterEndDate: Date?

    init(initialAccountId: String? = nil) {
        self.filterAccountId = initialAccountId
    }

    func loadInitial() async {
        state = .loading
        nextCursor = nil
        transactions = []
        do {
            let page = try await TransactionsService.list(
                cursor: nil,
                accountId: filterAccountId,
                startDate: filterStartDate,
                endDate: filterEndDate,
                categoryId: filterCategoryId
            )
            transactions = page.items
            nextCursor = page.nextCursor
            state = transactions.isEmpty ? .empty : .loaded(transactions)
        } catch let err as APIError {
            state = .error(err.errorDescription ?? "Erro inesperado")
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    func refresh() async {
        do {
            let page = try await TransactionsService.list(
                cursor: nil,
                accountId: filterAccountId,
                startDate: filterStartDate,
                endDate: filterEndDate,
                categoryId: filterCategoryId
            )
            transactions = page.items
            nextCursor = page.nextCursor
            state = transactions.isEmpty ? .empty : .loaded(transactions)
        } catch {
            // mantém o que tinha
        }
    }

    /// Disparado quando última linha aparece — carrega próxima página se houver cursor.
    func loadMoreIfNeeded(currentItem: Transaction) async {
        guard
            let last = transactions.last,
            last.id == currentItem.id,
            let cursor = nextCursor,
            !isFetchingMore
        else { return }

        isFetchingMore = true
        defer { isFetchingMore = false }

        do {
            let page = try await TransactionsService.list(
                cursor: cursor,
                accountId: filterAccountId,
                startDate: filterStartDate,
                endDate: filterEndDate,
                categoryId: filterCategoryId
            )
            transactions.append(contentsOf: page.items)
            nextCursor = page.nextCursor
            state = .loaded(transactions)
        } catch {
            // log futuro; não corrompe lista atual
        }
    }

    func applyFilters() async {
        showingFilters = false
        await loadInitial()
    }

    func clearFilters() async {
        filterAccountId = nil
        filterCategoryId = nil
        filterStartDate = nil
        filterEndDate = nil
        await loadInitial()
    }

    func updateLocalCategory(transactionId: String, category: Category) {
        if let idx = transactions.firstIndex(where: { $0.id == transactionId }) {
            let old = transactions[idx]
            let updated = Transaction(
                id: old.id,
                accountId: old.accountId,
                accountName: old.accountName,
                date: old.date,
                description: old.description,
                amount: old.amount,
                currency: old.currency,
                categoryId: category.id,
                categoryName: category.name,
                categoryIcon: category.icon,
                pending: old.pending
            )
            transactions[idx] = updated
            state = .loaded(transactions)
        }
    }
}
