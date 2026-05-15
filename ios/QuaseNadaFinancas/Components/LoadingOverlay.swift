import SwiftUI

struct LoadingOverlay: View {
    var message: String = "Carregando..."

    var body: some View {
        ZStack {
            Color.black.opacity(0.25).ignoresSafeArea()
            VStack(spacing: 12) {
                ProgressView().tint(.brandPrimaryAction)
                Text(message).font(.subheadline).foregroundColor(.brandTextPrimary)
            }
            .padding(20)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .accessibilityElement(children: .combine)
    }
}
