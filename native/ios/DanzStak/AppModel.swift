import AuthenticationServices
import Combine
import CryptoKit
import Foundation
import UIKit

@MainActor
final class AppModel: NSObject, ObservableObject, ASWebAuthenticationPresentationContextProviding {
    @Published var posts: [FeedPost] = []
    @Published var status = ""
    @Published var signedIn = SessionStore.load() != nil
    private let api = APIClient()
    private var webSession: ASWebAuthenticationSession?

    func start() async {
        guard signedIn else { status = "Log in to see your DanzStak feed."; return }
        await refresh()
    }

    func login() {
        let verifier = (0..<32).map { _ in String(format: "%02x", UInt8.random(in: .min ... .max)) }.joined()
        let challenge = SHA256.hash(data: Data(verifier.utf8)).map { String(format: "%02x", $0) }.joined()
        let url = URL(string: "https://api.danzstak.com/auth/mobile-login?platform=ios&challenge=\(challenge)")!
        webSession = ASWebAuthenticationSession(url: url, callbackURLScheme: "danzstak") { [weak self] callback, error in
            guard let self, error == nil, let callback,
                  callback.scheme == "danzstak", callback.host == "ios", callback.path == "/auth",
                  let code = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "code" })?.value,
                  code.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else { return }
            Task { await self.finishLogin(code: code, verifier: verifier) }
        }
        webSession?.presentationContextProvider = self
        webSession?.prefersEphemeralWebBrowserSession = false
        webSession?.start()
    }

    func refresh() async {
        status = "Loading feed…"
        do {
            guard try await api.validSession() else { throw APIClient.Failure.sessionExpired }
            posts = try await api.posts()
            status = posts.isEmpty ? "Your feed is ready. Be the first to post." : "\(posts.count) posts"
        } catch APIClient.Failure.sessionExpired {
            expireSession()
        } catch { status = "Feed could not be loaded. Please try again." }
    }

    func publish(_ text: String) async -> Bool {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return false }
        status = "Publishing…"
        do {
            try await api.publish(text)
            await refresh()
            return true
        } catch APIClient.Failure.sessionExpired {
            expireSession()
        } catch { status = "Post could not be published. Your draft is saved." }
        return false
    }

    private func expireSession() {
        signedIn = false
        SessionStore.clear()
        posts = []
        status = "Your session expired. Log in again."
    }

    func logout() async {
        try? await api.logout()
        SessionStore.clear(); posts = []; signedIn = false; status = "Signed out."
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first ?? UIWindow()
    }

    private func finishLogin(code: String, verifier: String) async {
        status = "Finishing secure login…"
        do {
            try SessionStore.save(try await api.exchange(code: code, verifier: verifier))
            signedIn = true
            await refresh()
        } catch { status = "Secure login could not be completed." }
    }
}
