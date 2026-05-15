import SwiftUI

struct SecondaryButton: View {
    let title: String
    var icon: String? = nil
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let icon { Image(systemName: icon) }
                Text(title).font(.headline)
            }
            .frame(maxWidth: .infinity, minHeight: 52)
            .foregroundColor(.brandPrimaryAction)
            .background(Color.brandPrimaryTint)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }
}
