import Foundation

extension Decimal {
    /// Formata como moeda BRL (ex.: "R$ 1.234,56").
    func formattedBRL() -> String {
        let f = NumberFormatter()
        f.locale = Locale(identifier: "pt_BR")
        f.numberStyle = .currency
        f.currencyCode = "BRL"
        return f.string(from: self as NSDecimalNumber) ?? "R$ 0,00"
    }

    /// Formata número sem símbolo, com 2 casas (para inputs).
    func formattedDecimal(fractionDigits: Int = 2) -> String {
        let f = NumberFormatter()
        f.locale = Locale(identifier: "pt_BR")
        f.minimumFractionDigits = fractionDigits
        f.maximumFractionDigits = fractionDigits
        return f.string(from: self as NSDecimalNumber) ?? "0,00"
    }

    /// Formata cripto com até 8 casas.
    func formattedCrypto(fractionDigits: Int = 8) -> String {
        let f = NumberFormatter()
        f.locale = Locale(identifier: "pt_BR")
        f.minimumFractionDigits = 2
        f.maximumFractionDigits = fractionDigits
        return f.string(from: self as NSDecimalNumber) ?? "0,00"
    }
}
