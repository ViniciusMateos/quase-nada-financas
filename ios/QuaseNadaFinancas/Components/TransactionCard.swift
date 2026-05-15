import SwiftUI

struct TransactionCard: View {
    let transaction: Transaction

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color.brandPrimaryTint)
                    .frame(width: 40, height: 40)
                Image(systemName: transaction.categoryIcon ?? "questionmark.circle")
                    .foregroundColor(.brandPrimaryAction)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.description)
                    .font(.subheadline)
                    .foregroundColor(.brandTextPrimary)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    if let cat = transaction.categoryName {
                        Text(cat).font(.caption).foregroundColor(.brandTextSecondary)
                    }
                    Text("·").font(.caption).foregroundColor(.brandTextSecondary)
                    Text(transaction.date.formattedShort())
                        .font(.caption).foregroundColor(.brandTextSecondary)
                }
            }

            Spacer()

            Text(transaction.amount.formattedBRL())
                .font(.subheadline.weight(.semibold))
                .foregroundColor(transaction.amount >= 0 ? .brandSuccess : .brandTextPrimary)
        }
        .padding(.vertical, 10)
    }
}
