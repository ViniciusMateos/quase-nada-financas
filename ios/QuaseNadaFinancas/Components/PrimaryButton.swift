import SwiftUI

struct PrimaryButton: View {
    let title: String
    var icon: String? = nil
    var isLoading: Bool = false
    var isDisabled: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView().tint(.white)
                } else if let icon {
                    Image(systemName: icon)
                }
                Text(title)
                    .font(.headline)
            }
            .frame(maxWidth: .infinity, minHeight: 52)
            .foregroundColor(.white)
            .background(
                isDisabled
                ? Color.brandTextSecondary.opacity(0.5)
                : Color.brandPrimaryAction
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .disabled(isDisabled || isLoading)
        .accessibilityLabel(title)
    }
}
