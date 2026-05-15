import SwiftUI
import WebKit

/// WKWebView que carrega o widget Pluggy Connect.
/// O widget chama uma URL postMessage com itemId; capturamos via UIDelegate.
struct ConnectBankView: View {
    let onComplete: (Bool) -> Void

    @State private var connectURL: URL?
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ZStack {
                if let url = connectURL {
                    PluggyWebView(url: url) { itemId in
                        Task {
                            do {
                                try await AccountsService.pluggyCallback(itemId: itemId)
                                onComplete(true)
                            } catch {
                                errorMessage = "Não foi possível concluir a conexão."
                            }
                        }
                    }
                }
                if isLoading {
                    LoadingOverlay(message: "Preparando conexão segura...")
                }
                if let errorMessage {
                    ErrorStateView(message: errorMessage) {
                        self.errorMessage = nil
                        Task { await loadConnectToken() }
                    }
                }
            }
            .navigationTitle("Conectar banco")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancelar") { onComplete(false) }
                }
            }
            .task { await loadConnectToken() }
        }
    }

    private func loadConnectToken() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let token = try await AccountsService.pluggyConnectToken()
            // URL do widget Pluggy hospedado.
            if let url = URL(string: "https://connect.pluggy.ai?connectToken=\(token.connectToken)") {
                connectURL = url
            }
        } catch {
            errorMessage = "Não foi possível abrir a conexão."
        }
    }
}

private struct PluggyWebView: UIViewRepresentable {
    let url: URL
    let onItemConnected: (String) -> Void

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let userController = WKUserContentController()
        userController.add(context.coordinator, name: "pluggyHandler")
        config.userContentController = userController

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onItemConnected: onItemConnected)
    }

    final class Coordinator: NSObject, WKScriptMessageHandler {
        let onItemConnected: (String) -> Void
        init(onItemConnected: @escaping (String) -> Void) {
            self.onItemConnected = onItemConnected
        }
        func userContentController(_ uc: WKUserContentController, didReceive msg: WKScriptMessage) {
            // Esperamos payload no formato { event: "ITEM_CONNECTED", itemId: "..." }
            guard
                let dict = msg.body as? [String: Any],
                let event = dict["event"] as? String,
                event == "ITEM_CONNECTED",
                let itemId = dict["itemId"] as? String
            else { return }
            DispatchQueue.main.async { self.onItemConnected(itemId) }
        }
    }
}
