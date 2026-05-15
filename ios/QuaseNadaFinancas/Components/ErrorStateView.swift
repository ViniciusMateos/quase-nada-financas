import SwiftUI

struct ErrorStateView: View {
    let message: String
    var onRetry: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 44))
                .foregroundColor(.brandError)
            Text("Algo deu errado")
                .font(.title3.bold())
                .foregroundColor(.brandTextPrimary)
            Text(message)
                .font(.subheadline)
                .foregroundColor(.brandTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)

            if let onRetry {
                PrimaryButton(title: "Tentar de novo", icon: "arrow.clockwise", action: onRetry)
                    .padding(.horizontal, 24)
                    .padding(.top, 8)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
}
