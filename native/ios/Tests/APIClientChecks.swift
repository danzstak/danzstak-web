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

        StubProtocol.status = 200
        StubProtocol.payload = #"{"reactionCounts":{"Like":2},"myReaction":"Like","comments":[{"commentId":"c1","authorName":"Member","content":"Hello","createdAt":"2026-10-28"}]}"#
        let activity = try await api.engagement("post & one")
        precondition(activity.total == 2 && activity.comments.count == 1)
        let query = URLComponents(url: StubProtocol.requests.last!.url!, resolvingAgainstBaseURL: false)?.queryItems
        precondition(query?.first?.value == "post & one")
        precondition(StubProtocol.requests.last?.url?.path == "/engagement")
        precondition(StubProtocol.requests.last?.value(forHTTPHeaderField: "Origin") == "https://www.danzstak.com")
        StubProtocol.payload = "{}"
        try await api.react("post1", reaction: "Like")
        precondition(StubProtocol.requests.last?.url?.path == "/reactions")
        try await api.comment("post1", text: "My comment")
        precondition(StubProtocol.requests.last?.url?.path == "/comments")
        StubProtocol.payload = #"{"groups":[{"id":"g1","name":"DJs","category":"Music","description":"Community"}]}"#
        let groups = try await api.groups()
        precondition(groups.first?.name == "DJs")
        StubProtocol.payload = #"{"notifications":[{"type":"comment","postId":"p1","preview":"Hello","createdAt":"2026-10-28","unread":true}]}"#
        let notices = try await api.notices()
        precondition(notices.first?.unread == true)
        StubProtocol.payload = "{}"
        try await api.markNoticesRead()
        precondition(StubProtocol.requests.last?.url?.path == "/engagement-notifications/read")
        StubProtocol.payload = #"{"stories":[{"storyId":"s1","displayName":"DJ","caption":"Tonight"}],"reels":[{"id":"r1","url":"https://example.com/reel","caption":"A set"}]}"#
        let mediaFeed = try await api.stories()
        precondition(mediaFeed.stories.first?.caption == "Tonight")
        precondition(mediaFeed.reels?.first?.id == "r1")
        precondition(StubProtocol.requests.last?.url?.path == "/stories")
        StubProtocol.payload = #"{"stories":[{"storyId":"s2","content":"API flash caption"}]}"#
        let flashes = try await api.stories()
        precondition(flashes.stories.first?.content == "API flash caption")

        let noSession = APIClient(session: session, sessionToken: { nil })
        let count = StubProtocol.requests.count
        do { _ = try await noSession.posts(); fatalError("Missing sessions must fail before networking") }
        catch APIClient.Failure.sessionExpired {}
        precondition(StubProtocol.requests.count == count)
        precondition(StubProtocol.requests.allSatisfy { $0.url?.scheme == "https" })
        print("API checks passed: feed, sessions, recovery, exchange, publish, logout, engagement, query encoding, comments, reactions, groups, notices, HTTPS.")
    }
}
