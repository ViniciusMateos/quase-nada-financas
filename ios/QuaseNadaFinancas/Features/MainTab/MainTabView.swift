import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            DashboardView()
                .tabItem {
                    Label("Início", systemImage: "house.fill")
                }

            AccountsView()
                .tabItem {
                    Label("Contas", systemImage: "creditcard.fill")
                }

            InvestmentsView()
                .tabItem {
                    Label("Investimentos", systemImage: "chart.line.uptrend.xyaxis")
                }

            SettingsView()
                .tabItem {
                    Label("Configurações", systemImage: "gearshape.fill")
                }
        }
        .tint(.brandPrimaryAction)
    }
}
