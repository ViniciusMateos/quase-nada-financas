import Foundation
import LocalAuthentication

/// Wrapper sobre LAContext para FaceID / TouchID.
enum BiometricAuth {

    enum BiometricError: LocalizedError {
        case notAvailable
        case userCancelled
        case failed(String)

        var errorDescription: String? {
            switch self {
            case .notAvailable: return "Biometria indisponível neste dispositivo."
            case .userCancelled: return "Autenticação cancelada."
            case .failed(let msg): return msg
            }
        }
    }

    /// Tipo de biometria disponível (para UI exibir ícone correto).
    static func availableType() -> LABiometryType {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return .none
        }
        return context.biometryType
    }

    /// Solicita autenticação biométrica — usado antes de confirmar ordens.
    static func authenticate(reason: String) async throws {
        let context = LAContext()
        context.localizedCancelTitle = "Cancelar"

        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            throw BiometricError.notAvailable
        }

        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            )
            if !success { throw BiometricError.failed("Falha na autenticação biométrica.") }
        } catch let laError as LAError {
            switch laError.code {
            case .userCancel, .systemCancel, .appCancel:
                throw BiometricError.userCancelled
            default:
                throw BiometricError.failed(laError.localizedDescription)
            }
        }
    }
}
