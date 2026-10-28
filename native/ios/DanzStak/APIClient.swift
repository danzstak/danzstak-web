import Foundation

struct FeedPost: Identifiable, Decodable {
    let id: String
    let author: String
    let text: String
    let createdAt: String
    var authorPicture: String? = nil
    var userEmail: String? = nil
    var isOwner: Bool? = nil
    var mediaUrl: String? = nil
    var mediaType: String? = nil

    enum CodingKeys: String, CodingKey {
        case id = "postId", author = "authorName", text = "content", createdAt
        case authorPicture, userEmail, isOwner, mediaUrl, mediaType
    }
}

struct FeedComment: Identifiable, Decodable {
    let commentId: String
    let authorName: String
    let content: String
    let createdAt: String
    var id: String { commentId }
}

struct Engagement: Decodable {
    var reactionCounts: [String: Int] = [:]
    var myReaction = ""
    var comments: [FeedComment] = []
    var total: Int { reactionCounts.values.reduce(0, +) }
}

struct CommunityGroup: Identifiable, Decodable {
    let id: String
    let name: String
    let category: String
    let description: String
}

struct FeedNotice: Identifiable, Decodable {
    let type: String
    let postId: String
    let preview: String
    let createdAt: String
    var unread: Bool
    var id: String { postId + type + createdAt + preview }
}

private struct FeedResponse: Decodable { let posts: [FeedPost] }
private struct SessionResponse: Decodable { let authenticated: Bool }
private struct ExchangeResponse: Decodable { let sessionToken: String }
private struct GroupResponse: Decodable { let groups: [CommunityGroup] }
private struct NoticeResponse: Decodable { let notifications: [FeedNotice] }

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

    func engagement(_ postID: String) async throws -> Engagement {
        let query = URLQueryItem(name: "postId", value: postID)
        var components = URLComponents()
        components.queryItems = [query]
        return try await send("/engagement" + (components.string ?? ""))
    }

    func react(_ postID: String, reaction: String) async throws {
        let _: EmptyResponse = try await send("/reactions", method: "POST", body: ["postId": postID, "reaction": reaction])
    }

    func comment(_ postID: String, text: String) async throws {
        let _: EmptyResponse = try await send("/comments", method: "POST", body: ["postId": postID, "content": text])
    }

    func groups() async throws -> [CommunityGroup] {
        let response: GroupResponse = try await send("/groups")
        return response.groups
    }

    func notices() async throws -> [FeedNotice] {
        let response: NoticeResponse = try await send("/engagement-notifications")
        return response.notifications
    }

    func markNoticesRead() async throws {
        let _: EmptyResponse = try await send("/engagement-notifications/read", method: "POST", body: [:])
    }

    private struct EmptyResponse: Decodable {}

    private func send<Response: Decodable>(_ path: String, method: String = "GET", body: [String: Any]? = nil, authenticated: Bool = true) async throws -> Response {
        guard let url = URL(string: path, relativeTo: base)?.absoluteURL,
              url.scheme == "https", url.host == base.host else { throw URLError(.badURL) }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("https://www.danzstak.com", forHTTPHeaderField: "Origin")
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
