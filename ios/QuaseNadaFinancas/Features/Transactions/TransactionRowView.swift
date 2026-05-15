import SwiftUI

struct TransactionRowView: View {
    let transaction: Transaction

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(Color.brandPrimaryTint).frame(width: 38, height: 38)
                Image(systemName: transaction.categoryIcon ?? "questionmark")
                    .foregroundColor(.brandPrimaryAction)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.description)
                    .font(.subheadline)
                    .foregroundColor(.brandTextPrimary)
                    .lineLimit(1)
                Text("\(transaction.categoryName ?? "Sem categoria") · \(transaction.date.formattedShort())")
                    .font(.caption)
                    .foregroundColor(.brandTextSecondary)
            }
            Spacer()
            Text(transaction.amount.formattedBRL())
                .font(.subheadline.weight(.semibold))
                .foregroundColor(transaction.amount >= 0 ? .brandSuccess : .brandTextPrimary)
        }
        .padding(.vertical, 4)
    }
}
