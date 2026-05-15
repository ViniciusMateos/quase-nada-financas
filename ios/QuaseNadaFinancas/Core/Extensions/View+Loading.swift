import SwiftUI

extension View {
    /// Aplica overlay de loading que bloqueia interação enquanto isLoading == true.
    func loadingOverlay(_ isLoading: Bool, message: String = "Carregando...") -> some View {
        ZStack {
            self
            if isLoading {
                LoadingOverlay(message: message)
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: isLoading)
    }
}
