import SwiftUI

struct OrderResultView: View {
    let order: InvestmentOrder
    let onClose: () -> Void

    var isSuccess: Bool { order.status == "filled" }

    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            ZStack {
                Circle()
                    .fill(isSuccess ? Color.brandSuccess.opacity(0.15) : Color.brandError.opacity(0.15))
                    .frame(width: 120, height: 120)
                Image(systemName: isSuccess ? "checkmark.circle.fill" : "xmark.octagon.fill")
                    .font(.system(size: 64))
                    .foregroundColor(isSuccess ? .brandSuccess : .brandError)
            }

            Text(isSuccess ? "Ordem executada!" : "Não foi possível concluir")
                .font(.title2.bold())
                .foregroundColor(.brandTextPrimary)

            VStack(spacing: 4) {
                Text("\(order.symbol) · \(order.side == .buy ? "Compra" : "Venda")")
                    .font(.subheadline)
                    .foregroundColor(.brandTextSecondary)
                Text(order.amountBRL.formattedBRL())
                    .font(.title3.bold())
                    .foregroundColor(.brandTextPrimary)
                if let qty = order.executedQuantity {
                    Text("\(qty.formattedCrypto()) \(order.symbol)")
                        .font(.subheadline)
                        .foregroundColor(.brandTextSecondary)
                }
                if let err = order.errorMessage {
                    Text(err)
                        .font(.caption)
                        .foregroundColor(.brandError)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                }
            }

            Spacer()

            PrimaryButton(title: "Concluir") { onClose() }
                .padding(.horizontal, 24)
                .padding(.bottom, 16)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.brandBackground.ignoresSafeArea())
    }
}
