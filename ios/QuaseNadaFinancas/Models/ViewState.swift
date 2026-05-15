import Foundation

/// Estado genérico para qualquer tela orientada a dados.
enum ViewState<Data> {
    case idle
    case loading
    case loaded(Data)
    case empty
    case error(String)
}
