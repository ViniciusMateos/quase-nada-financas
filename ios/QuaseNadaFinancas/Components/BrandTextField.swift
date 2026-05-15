import SwiftUI

struct BrandTextField: View {
    let title: String
    @Binding var text: String
    var keyboardType: UIKeyboardType = .default
    var textContentType: UITextContentType? = nil
    var autocapitalization: TextInputAutocapitalization = .never
    var errorMessage: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.subheadline)
                .foregroundColor(.brandTextSecondary)

            TextField("", text: $text)
                .keyboardType(keyboardType)
                .textContentType(textContentType)
                .textInputAutocapitalization(autocapitalization)
                .autocorrectionDisabled()
                .padding(.horizontal, 14)
                .frame(height: 52)
                .background(Color.white)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(errorMessage == nil ? Color.brandTextSecondary.opacity(0.25) : Color.brandError, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 12))

            if let err = errorMessage {
                Text(err).font(.caption).foregroundColor(.brandError)
            }
        }
    }
}
