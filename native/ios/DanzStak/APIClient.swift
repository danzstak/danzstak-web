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

    var location: String? = nil
    var taggedUsers: [TaggedMember]? = nil

    enum CodingKeys: String, CodingKey {
        case id = "postId", author = "authorName", text = "content", createdAt
        case authorPicture, userEmail, isOwner, mediaUrl, mediaType, location, taggedUsers
    }
}

struct FeedComment: Identifiable, Decodable {
    let commentId: String
    let authorName: String
    let content: String
    let createdAt: String
    var authorPicture: String? = nil
    var id: String { commentId }
}

struct FeedStory: Identifiable, Decodable {
    let storyId: String
    var displayName: String? = nil
    var caption: String? = nil
    var content: String? = nil
    var mediaUrl: String? = nil
    var mediaType: String? = nil
    var id: String { storyId }
}

struct FeedReel: Identifiable, Decodable {
    let id: String
    var url: String? = nil
    var caption: String? = nil
    var displayName: String? = nil
}

struct StoryCollection: Decodable {
    let stories: [FeedStory]
    let reels: [FeedReel]?
}

struct Engagement: Decodable {
    var reactionCounts: [String: Int] = [:]
    var myReaction = ""
    var comments: [FeedComment] = []
    var reactors: [FeedReactor]? = nil
    var total: Int { reactionCounts.values.reduce(0, +) }
}

struct FeedReactor: Decodable {
    let name: String
    var picture: String? = nil
    var reaction: String? = nil
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

    struct PublishedPost: Decodable { let postId: String }
    func publish(_ text: String, location: String = "") async throws -> String {
        let result: PublishedPost = try await send("/secure-posts", method: "POST", body: ["content": text, "location": location, "audience": "public", "originalContentCertified": true])
        return result.postId
    }

    func friendsForTags() async throws -> [TagFriend] {
        let result: TagDirectory = try await send("/calls/directory")
        return result.users.filter { $0.friendStatus == "friends" }
    }
    func editTags(_ id: String, members: [String], location: String) async throws {
        let _: EmptyResponse = try await send("/secure-posts/" + id, method: "PATCH", body: ["taggedMembers": members, "location": location])
    }
    func removeMyTag(_ id: String) async throws {
        let _: EmptyResponse = try await send("/secure-posts/" + id, method: "PATCH", body: ["removeOwnTag": true])
    }
    func taggingSettings() async throws -> TaggingSettings { try await send("/settings/presence") }
    func saveTaggingSettings(_ settings: TaggingSettings) async throws {
        let _: EmptyResponse = try await send("/settings/presence", method: "POST", body: ["allowTags": settings.allowTags, "onlineVisible": settings.onlineVisible ?? true, "darkMode": settings.darkMode ?? false, "reduceMotion": settings.reduceMotion ?? false, "dataSaver": settings.dataSaver ?? false, "language": settings.language ?? "en"])
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

    func stories() async throws -> StoryCollection {
        return try await send("/stories")
    }

    func markNoticesRead() async throws {
        let _: EmptyResponse = try await send("/engagement-notifications/read", method: "POST", body: [:])
    }

    func conversations() async throws -> [ChatConversation] {
        let result: ChatConversations = try await send("/conversations")
        return result.conversations
    }
    func chatContacts() async throws -> [ChatContact] {
        let result: ChatDirectory = try await send("/calls/directory")
        return result.users.filter { $0.friendStatus == "friends" || $0.sharedGroup == true }
    }
    func messages(_ contact: String, before: String? = nil) async throws -> ChatMessages {
        var components = URLComponents()
        components.queryItems = [URLQueryItem(name: "contact", value: contact), URLQueryItem(name: "read", value: "1")]
        if let before { components.queryItems?.append(URLQueryItem(name: "before", value: before)) }
        return try await send("/messages" + (components.string ?? ""))
    }
    func sendMessage(to contact: String, text: String) async throws -> ChatMessage {
        let result: SentChatMessage = try await send("/messages", method: "POST", body: ["recipientEmail": contact, "content": text])
        return result.message
    }
    func reactToMessage(contact: String, message: String, reaction: String) async throws {
        let _: EmptyResponse = try await send("/messages", method: "POST", body: ["action": "reaction", "contactEmail": contact, "messageId": message, "reaction": reaction])
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

struct TaggedMember: Decodable, Identifiable {
    let memberId: String
    let name: String
    var isMe: Bool? = nil
    var id: String { memberId }
}
struct TagFriend: Decodable, Identifiable {
    let memberId: String
    let name: String
    var picture: String? = nil
    let friendStatus: String
    var id: String { memberId }
}
private struct TagDirectory: Decodable { let users: [TagFriend] }
struct TaggingSettings: Decodable {
    var allowTags: Bool
    var onlineVisible: Bool? = nil
    var darkMode: Bool? = nil
    var reduceMotion: Bool? = nil
    var dataSaver: Bool? = nil
    var language: String? = nil
}

struct ChatConversation: Decodable, Identifiable {
    let contactEmail: String
    let name: String
    var picture: String? = nil
    var preview = ""
    var updatedAt = ""
    var unread = 0
    var canContact = true
    var id: String { contactEmail }
}
struct ChatContact: Decodable, Identifiable {
    let email: String
    let name: String
    var picture: String? = nil
    var friendStatus: String? = nil
    var sharedGroup: Bool? = nil
    var id: String { email }
    var conversation: ChatConversation { ChatConversation(contactEmail: email, name: name, picture: picture) }
}
struct ChatMessage: Decodable, Identifiable {
    let messageId: String
    let senderEmail: String
    let recipientEmail: String
    let content: String
    let createdAt: String
    var reactionCounts: [String: Int]? = nil
    var myReaction: String? = nil
    var id: String { messageId }
}
struct ChatMessages: Decodable {
    let messages: [ChatMessage]
    let nextCursor: String?
    let canContact: Bool
}
private struct ChatConversations: Decodable { let conversations: [ChatConversation] }
private struct ChatDirectory: Decodable { let users: [ChatContact] }
private struct SentChatMessage: Decodable { let message: ChatMessage }
