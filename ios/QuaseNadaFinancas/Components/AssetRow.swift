import SwiftUI

struct AssetRow: View {
    let asset: BinanceWallet.Asset

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color.brandPrimaryTint)
                    .frame(width: 40, height: 40)
                Text(String(asset.symbol.prefix(2)))
                    .font(.caption.bold())
                    .foregroundColor(.brandPrimaryAction)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(asset.name ?? asset.symbol)
                    .font(.subheadline)
                    .foregroundColor(.brandTextPrimary)
                Text("\(asset.amount.formattedCrypto()) \(asset.symbol)")
                    .font(.caption)
                    .foregroundColor(.brandTextSecondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(asset.amountBRL.formattedBRL())
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.brandTextPrimary)
                Text(asset.priceBRL.formattedBRL())
                    .font(.caption)
                    .foregroundColor(.brandTextSecondary)
            }
        }
        .padding(.vertical, 8)
    }
}
