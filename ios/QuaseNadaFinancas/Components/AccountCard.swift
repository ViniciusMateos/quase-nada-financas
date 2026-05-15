import SwiftUI

struct AccountCard: View {
    let account: Account

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: iconForType(account.type))
                    .foregroundColor(.brandPrimaryAction)
                    .padding(8)
                    .background(Color.brandPrimaryTint)
                    .clipShape(Circle())

                VStack(alignment: .leading, spacing: 2) {
                    Text(account.name)
                        .font(.headline)
                        .foregroundColor(.brandTextPrimary)
                    Text(account.institution)
                        .font(.caption)
                        .foregroundColor(.brandTextSecondary)
                }
                Spacer()
            }

            Text(account.balance.formattedBRL())
                .font(.title2.bold())
                .foregroundColor(.brandTextPrimary)

            if let last = account.lastSyncedAt {
                Text("Atualizado em \(last.formattedDateTime())")
                    .font(.caption2)
                    .foregroundColor(.brandTextSecondary)
            }
        }
        .padding(16)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
    }

    private func iconForType(_ type: String) -> String {
        switch type {
        case "credit_card": return "creditcard.fill"
        case "savings": return "banknote.fill"
        default: return "building.columns.fill"
        }
    }
}
