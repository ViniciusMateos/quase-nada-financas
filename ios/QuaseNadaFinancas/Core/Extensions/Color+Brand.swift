import SwiftUI

/// Paleta de marca Quase Nada Finanças.
extension Color {
    static let brandPrimary       = Color(hex: 0x22C55E) // Verde Quase Nada
    static let brandPrimaryAction = Color(hex: 0x16A34A) // Verde Ação (botões)
    static let brandPrimaryDark   = Color(hex: 0x15803D) // Verde Profundo (pressed)
    static let brandPrimaryTint   = Color(hex: 0xDCFCE7) // Verde Clarissimo (cards)
    static let brandAccent        = Color(hex: 0x10B981) // Esmeralda
    static let brandSuccess       = Color(hex: 0x16A34A)
    static let brandError         = Color(hex: 0xFF3B5C)
    static let brandWarning       = Color(hex: 0xFF9F0A)
    static let brandBackground    = Color(hex: 0xF5F7FA)
    static let brandTextPrimary   = Color(hex: 0x1A2030)
    static let brandTextSecondary = Color(hex: 0x8E97A8)

    init(hex: UInt32, alpha: Double = 1.0) {
        let r = Double((hex >> 16) & 0xFF) / 255.0
        let g = Double((hex >> 8) & 0xFF) / 255.0
        let b = Double(hex & 0xFF) / 255.0
        self.init(.sRGB, red: r, green: g, blue: b, opacity: alpha)
    }
}
