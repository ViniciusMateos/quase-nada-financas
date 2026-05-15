import SwiftUI

struct TransactionDetailView: View {
    let transaction: Transaction
    var onCategoryUpdated: ((Category) -> Void)? = nil

    @State private var showingEditCategory = false
    @State private var currentTransaction: Transaction
    @State private var isUpdating = false
    @State private var errorMessage: String?

    init(transaction: Transaction, onCategoryUpdated: ((Category) -> Void)? = nil) {
        self.transaction = transaction
        self.onCategoryUpdated = onCategoryUpdated
        self._currentTransaction = State(initialValue: transaction)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                header
                detailGrid
                changeCategoryButton
                if let errorMessage {
                    Text(errorMessage).font(.subheadline).foregroundColor(.brandError)
                }
            }
            .padding(20)
        }
        .background(Color.brandBackground.ignoresSafeArea())
        .navigationTitle("Detalhes")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showingEditCategory) {
            EditCategorySheet(currentCategoryId: currentTransaction.categoryId) { category in
                Task { await updateCategory(category) }
            }
            .presentationDetents([.medium, .large])
        }
    }

    private var header: some View {
        VStack(spacing: 8) {
            ZStack {
                Circle().fill(Color.brandPrimaryTint).frame(width: 64, height: 64)
                Image(systemName: currentTransaction.categoryIcon ?? "tag.fill")
                    .font(.title)
                    .foregroundColor(.brandPrimaryAction)
            }
            Text(currentTransaction.description)
                .font(.title3.bold())
                .foregroundColor(.brandTextPrimary)
                .multilineTextAlignment(.center)
            Text(currentTransaction.amount.formattedBRL())
                .font(.largeTitle.bold())
                .foregroundColor(currentTransaction.amount >= 0 ? .brandSuccess : .brandTextPrimary)
        }
        .frame(maxWidth: .infinity)
        .padding(20)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var detailGrid: some View {
        VStack(spacing: 0) {
            row(label: "Data", value: currentTransaction.date.formattedDateTime())
            Divider()
            row(label: "Conta", value: currentTransaction.accountName ?? "—")
            Divider()
            row(label: "Categoria", value: currentTransaction.categoryName ?? "Sem categoria")
            Divider()
            row(label: "Status", value: currentTransaction.pending ? "Pendente" : "Confirmada")
        }
        .padding(.horizontal, 14)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func row(label: String, value: String) -> some View {
        HStack {
            Text(label).font(.subheadline).foregroundColor(.brandTextSecondary)
            Spacer()
            Text(value).font(.subheadline).foregroundColor(.brandTextPrimary)
        }
        .padding(.vertical, 12)
    }

    private var changeCategoryButton: some View {
        PrimaryButton(
            title: "Alterar categoria",
            icon: "pencil",
            isLoading: isUpdating
        ) {
            showingEditCategory = true
        }
    }

    private func updateCategory(_ category: Category) async {
        isUpdating = true
        errorMessage = nil
        defer { isUpdating = false }
        do {
            let updated = try await TransactionsService.updateCategory(
                transactionId: currentTransaction.id,
                categoryId: category.id
            )
            currentTransaction = updated
            onCategoryUpdated?(category)
            showingEditCategory = false
        } catch let err as APIError {
            errorMessage = err.errorDescription
        } catch {
            errorMessage = "Não foi possível atualizar a categoria."
        }
    }
}
