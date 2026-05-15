import SwiftUI

struct SecureFieldWithToggle: View {
    let title: String
    @Binding var text: String
    var textContentType: UITextContentType? = .password
    var errorMessage: String? = nil

    @State private var isVisible = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.subheadline)
                .foregroundColor(.brandTextSecondary)

            HStack {
                Group {
                    if isVisible {
                        TextField("", text: $text)
                    } else {
                        SecureField("", text: $text)
                    }
                }
                .textContentType(textContentType)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()

                Button {
                    isVisible.toggle()
                } label: {
                    Image(systemName: isVisible ? "eye.slash.fill" : "eye.fill")
                        .foregroundColor(.brandTextSecondary)
                }
                .accessibilityLabel(isVisible ? "Ocultar senha" : "Mostrar senha")
            }
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
