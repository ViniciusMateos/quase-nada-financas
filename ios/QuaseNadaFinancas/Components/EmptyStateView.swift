import SwiftUI

struct EmptyStateView: View {
    let icon: String
    let title: String
    let subtitle: String
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundColor(.brandPrimaryAction)
            Text(title).font(.title3.bold()).foregroundColor(.brandTextPrimary)
            Text(subtitle)
                .font(.subheadline)
                .foregroundColor(.brandTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)

            if let actionTitle, let action {
                PrimaryButton(title: actionTitle, action: action)
                    .padding(.horizontal, 24)
                    .padding(.top, 8)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
}
