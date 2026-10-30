import UIKit
import Capacitor
import AuthenticationServices

// El login nunca se ejecuta dentro de WKWebView. La sesión del sistema
// devuelve sólo el código PKCE; el token de Apple se valida en Supabase.
@objc(TrattoAuthPlugin)
public class TrattoAuthPlugin: CAPPlugin, CAPBridgedPlugin,
    ASWebAuthenticationPresentationContextProviding,
    ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "TrattoAuthPlugin"
    public let jsName = "TrattoAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openOAuth", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signInWithApple", returnType: CAPPluginReturnPromise)
    ]

    private var webSession: ASWebAuthenticationSession?
    private var appleController: ASAuthorizationController?
    private var appleCall: CAPPluginCall?
    private var anchor: ASPresentationAnchor?

    private func prepare(_ call: CAPPluginCall) -> Bool {
        // Las páginas de pago admitidas por allowNavigation no pueden pedir
        // credenciales de Tratto a través de este puente.
        guard let page = bridge?.webView?.url, page.scheme == "https",
              page.host == "www.trattoapp.com.ar", page.port == nil else {
            call.reject("El ingreso sólo está disponible dentro de Tratto.", "AUTH_INVALID_ORIGIN")
            return false
        }
        guard webSession == nil, appleCall == nil else {
            call.reject("Ya hay un ingreso en curso.", "AUTH_BUSY")
            return false
        }
        guard let window = bridge?.viewController?.viewIfLoaded?.window else {
            call.reject("La pantalla de ingreso todavía no está lista.", "AUTH_NOT_READY")
            return false
        }
        anchor = window
        return true
    }

    @objc func openOAuth(_ call: CAPPluginCall) {
        guard let value = call.getString("url"), let parts = URLComponents(string: value),
              let url = parts.url, parts.scheme == "https",
              parts.host == "qglsonbcsncgekzbfafk.supabase.co", parts.path == "/auth/v1/authorize",
              parts.user == nil, parts.password == nil, parts.port == nil, parts.fragment == nil else {
            call.reject("La dirección de ingreso no es válida.", "AUTH_INVALID_URL")
            return
        }
        let items = parts.queryItems ?? []
        guard Set(items.map(\.name)).count == items.count,
              items.first(where: { $0.name == "provider" })?.value == "google",
              items.first(where: { $0.name == "redirect_to" })?.value == "ar.com.trattoapp.auth://callback",
              items.first(where: { $0.name == "code_challenge_method" })?.value == "s256",
              let challenge = items.first(where: { $0.name == "code_challenge" })?.value,
              challenge.range(of: "^[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil else {
            call.reject("La solicitud de ingreso no es válida.", "AUTH_INVALID_URL")
            return
        }
        DispatchQueue.main.async {
            guard self.prepare(call) else { return }
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "ar.com.trattoapp.auth") { [weak self] callback, error in
                DispatchQueue.main.async {
                    guard let self = self else { return }
                    self.webSession = nil
                    self.anchor = nil
                    if let error = error {
                        let canceled = (error as? ASWebAuthenticationSessionError)?.code == .canceledLogin
                        call.reject(canceled ? "Cancelaste el ingreso." : "No se pudo completar el ingreso.",
                                    canceled ? "AUTH_CANCELED" : "AUTH_FAILED")
                        return
                    }
                    guard let callback = callback, callback.scheme == "ar.com.trattoapp.auth",
                          callback.host == "callback", ["", "/"].contains(callback.path),
                          callback.user == nil, callback.password == nil, callback.port == nil,
                          callback.fragment == nil else {
                        call.reject("El regreso de la autorización no es válido.", "AUTH_INVALID_CALLBACK")
                        return
                    }
                    call.resolve(["callbackUrl": callback.absoluteString])
                }
            }
            self.webSession = session
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            if !session.start() {
                self.webSession = nil
                self.anchor = nil
                call.reject("No se pudo abrir el ingreso del sistema.", "AUTH_NOT_STARTED")
            }
        }
    }

    @objc func signInWithApple(_ call: CAPPluginCall) {
        guard let nonce = call.getString("nonceHash"),
              nonce.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else {
            call.reject("La solicitud de Apple no es válida.", "AUTH_INVALID_NONCE")
            return
        }
        DispatchQueue.main.async {
            guard self.prepare(call) else { return }
            self.appleCall = call
            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            request.nonce = nonce
            let controller = ASAuthorizationController(authorizationRequests: [request])
            self.appleController = controller
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let call = appleCall else { return }
        defer { appleCall = nil; appleController = nil; anchor = nil }
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let data = credential.identityToken, let token = String(data: data, encoding: .utf8) else {
            call.reject("Apple no devolvió una credencial.", "AUTH_NO_TOKEN")
            return
        }
        var result: [String: Any] = ["identityToken": token]
        if let name = credential.fullName {
            let formatted = PersonNameComponentsFormatter.localizedString(from: name, style: .default)
            if !formatted.isEmpty { result["fullName"] = formatted }
        }
        call.resolve(result)
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let call = appleCall else { return }
        appleCall = nil
        appleController = nil
        anchor = nil
        let canceled = (error as? ASAuthorizationError)?.code == .canceled
        call.reject(canceled ? "Cancelaste el ingreso." : "No se pudo completar el ingreso con Apple.",
                    canceled ? "AUTH_CANCELED" : "AUTH_FAILED")
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        anchor ?? ASPresentationAnchor()
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        anchor ?? ASPresentationAnchor()
    }
}

class TrattoBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(TrattoAuthPlugin())
    }
}
