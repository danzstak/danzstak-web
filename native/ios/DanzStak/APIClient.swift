import Foundation

struct FeedPost: Identifiable, Decodable {
    let id: String
    let author: String
    let text: String
    let createdAt: String

    enum CodingKeys: String, CodingKey { case id = "postId", author = "authorName", text = "content", createdAt }
}

private struct FeedResponse: Decodable { let posts: [FeedPost] }
private struct SessionResponse: Decodable { let authenticated: Bool }
private struct ExchangeResponse: Decodable { let sessionToken: String }

struct APIClient {
    private let base = URL(string: "https://api.danzstak.com")!
    private let session: URLSession
    private let sessionToken: () -> String?

    init(session: URLSession = .shared, sessionToken: @escaping () -> String? = SessionStore.load) {
        self.session = session
        self.sessionToken = sessionToken
    }

    enum Failure: Error { case sessionExpired }

    func exchange(code: String, verifier: String) async throws -> String {
        let response: ExchangeResponse = try await send("/auth/mobile-session", method: "POST", body: ["code": code, "verifier": verifier, "platform": "ios"], authenticated: false)
        return response.sessionToken
    }

    func validSession() async throws -> Bool {
        let response: SessionResponse = try await send("/auth/session")
        return response.authenticated
    }

    func posts() async throws -> [FeedPost] {
        let response: FeedResponse = try await send("/secure-posts")
        return response.posts
    }

    func publish(_ text: String) async throws {
        let _: EmptyResponse = try await send("/secure-posts", method: "POST", body: ["content": text, "audience": "public", "originalContentCertified": true])
    }

    func logout() async throws {
        let _: EmptyResponse = try await send("/auth/logout", method: "POST", body: [:])
    }

    private struct EmptyResponse: Decodable {}

    private func send<Response: Decodable>(_ path: String, method: String = "GET", body: [String: Any]? = nil, authenticated: Bool = true) async throws -> Response {
        var request = URLRequest(url: base.appending(path: path))
        request.httpMethod = method
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if authenticated {
            guard let token = sessionToken() else { throw Failure.sessionExpired }
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        if authenticated && http.statusCode == 401 { throw Failure.sessionExpired }
        guard 200..<300 ~= http.statusCode else { throw URLError(.badServerResponse) }
        if data.isEmpty, Response.self == EmptyResponse.self { return EmptyResponse() as! Response }
        return try JSONDecoder().decode(Response.self, from: data)
    }
}
