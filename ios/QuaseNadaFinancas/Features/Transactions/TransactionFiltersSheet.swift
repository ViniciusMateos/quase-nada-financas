import SwiftUI

struct TransactionFiltersSheet: View {
    @ObservedObject var viewModel: TransactionsViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var startDate: Date = .now
    @State private var endDate: Date = .now
    @State private var hasStartDate = false
    @State private var hasEndDate = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Período") {
                    Toggle("Filtrar por data inicial", isOn: $hasStartDate)
                    if hasStartDate {
                        DatePicker("De", selection: $startDate, displayedComponents: .date)
                    }
                    Toggle("Filtrar por data final", isOn: $hasEndDate)
                    if hasEndDate {
                        DatePicker("Até", selection: $endDate, displayedComponents: .date)
                    }
                }
                Section {
                    Button("Aplicar filtros") {
                        viewModel.filterStartDate = hasStartDate ? startDate : nil
                        viewModel.filterEndDate = hasEndDate ? endDate : nil
                        Task { await viewModel.applyFilters() }
                    }
                    .foregroundColor(.brandPrimaryAction)
                    Button("Limpar filtros", role: .destructive) {
                        hasStartDate = false
                        hasEndDate = false
                        Task { await viewModel.clearFilters() }
                        dismiss()
                    }
                }
            }
            .navigationTitle("Filtros")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fechar") { dismiss() }
                }
            }
            .onAppear {
                if let s = viewModel.filterStartDate { startDate = s; hasStartDate = true }
                if let e = viewModel.filterEndDate { endDate = e; hasEndDate = true }
            }
        }
    }
}
