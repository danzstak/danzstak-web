// Run on macOS using the command documented in README.md. No live account is used.
import Foundation

final class StubProtocol: URLProtocol {
    static var status = 200
    static var payload = "{}"
    static var failure: URLError?
    static var requests: [URLRequest] = []

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.requests.append(request)
        if let failure = Self.failure {
            client?.urlProtocol(self, didFailWithError: failure)
            return
        }
        let response = HTTPURLResponse(url: request.url!, statusCode: Self.status,
                                       httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(Self.payload.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

@main
struct APIClientChecks {
    static func main() async throws {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubProtocol.self]
        let session = URLSession(configuration: config)
        defer { session.invalidateAndCancel() }
        let api = APIClient(session: session, sessionToken: { "opaque-test-session" })

        StubProtocol.payload = #"{"posts":[{"postId":"1","authorName":"Test","content":"Hello","createdAt":"2026-10-27"}]}"#
        let posts = try await api.posts()
        precondition(posts.count == 1 && posts[0].text == "Hello")
        precondition(StubProtocol.requests.last?.value(forHTTPHeaderField: "Authorization") == "Bearer opaque-test-session")

        StubProtocol.payload = #"{"authenticated":false}"#
        let valid = try await api.validSession()
        precondition(!valid)

        StubProtocol.status = 401
        do { _ = try await api.posts(); fatalError("401 must expire the session") }
        catch APIClient.Failure.sessionExpired {}

        StubProtocol.status = 503
        do { _ = try await api.posts(); fatalError("503 must fail") }
        catch let error as URLError { precondition(error.code == .badServerResponse) }

        StubProtocol.failure = URLError(.notConnectedToInternet)
        do { _ = try await api.posts(); fatalError("Offline requests must fail") }
        catch let error as URLError { precondition(error.code == .notConnectedToInternet) }
        StubProtocol.failure = nil

        StubProtocol.status = 200
        StubProtocol.payload = #"{"sessionToken":"opaque-exchange-session"}"#
        let token = try await api.exchange(code: "code", verifier: "verifier")
        precondition(token == "opaque-exchange-session")
        precondition(StubProtocol.requests.last?.value(forHTTPHeaderField: "Authorization") == nil)

        StubProtocol.status = 204
        StubProtocol.payload = ""
        try await api.publish("Hello")
        precondition(StubProtocol.requests.last?.httpMethod == "POST")
        precondition(StubProtocol.requests.last?.url?.path == "/secure-posts")
        try await api.logout()
        precondition(StubProtocol.requests.last?.url?.path == "/auth/logout")

        let noSession = APIClient(session: session, sessionToken: { nil })
        let count = StubProtocol.requests.count
        do { _ = try await noSession.posts(); fatalError("Missing sessions must fail before networking") }
        catch APIClient.Failure.sessionExpired {}
        precondition(StubProtocol.requests.count == count)
        precondition(StubProtocol.requests.allSatisfy { $0.url?.scheme == "https" })
        print("API checks passed: feed decoding, session validation, 401, 503, offline recovery, exchange, publish, logout, HTTPS.")
    }
}
