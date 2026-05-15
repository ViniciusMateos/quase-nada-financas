import Foundation

extension Date {
    /// Ex.: "10 de mai. de 2026"
    func formattedShort() -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "pt_BR")
        f.dateStyle = .medium
        return f.string(from: self)
    }

    /// Ex.: "10/05/2026 14:32"
    func formattedDateTime() -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "pt_BR")
        f.dateFormat = "dd/MM/yyyy HH:mm"
        return f.string(from: self)
    }

    /// Ex.: "maio de 2026"
    func formattedMonthYear() -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "pt_BR")
        f.dateFormat = "LLLL 'de' yyyy"
        return f.string(from: self).capitalized
    }

    /// Formato YYYY-MM para query do dashboard.
    func toMonthQueryString() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM"
        return f.string(from: self)
    }
}
