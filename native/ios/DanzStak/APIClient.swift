import Foundation

struct MemberProfileResponse: Decodable { let profile: MemberProfile }
struct MemberProfile: Decodable {
    let name: String
    let handle: String?
    let bio: String?
    let picture: String?
    let cover: String?
    let location: String?
    let work: String?
    let website: String?
}

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
    var isOwner: Bool? = nil
    static let categories: [(raw: String, name: String, id: String)] = [
        ("Artists", "Visual Artist", "default-0"), ("Creators", "Bands", "default-6"),
        ("DJs & Producers", "DJs & Producers", "default-1"), ("Fans", "Fans", "default-2"),
        ("Venues & Promoters", "Venues", "default-3"), ("Local Scenes", "Scenes", "default-5"),
        ("Industry Networking", "Industry", "default-7"), ("Events", "Events", "default-4"),
        ("Politics", "Politics", "default-8"), ("Religion", "Religion", "default-9")
    ]
    static var defaults: [CommunityGroup] { categories.map { CommunityGroup(id: $0.id, name: $0.name, category: $0.raw, description: "Connect in \($0.name.lowercased()).") } }
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

    func memberProfile(email: String? = nil) async throws -> MemberProfile {
        var components = URLComponents()
        if let email, !email.isEmpty { components.queryItems = [URLQueryItem(name: "email", value: email)] }
        let response: MemberProfileResponse = try await send("/profiles" + (components.string ?? ""))
        return response.profile
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

    func groupMemberships() async throws -> Set<String> {
        struct Response: Decodable { let groupIds: [String] }
        let result: Response = try await send("/groups/membership", method: "POST", body: ["action": "list"])
        return Set(result.groupIds)
    }
    func joinGroup(_ id: String, joined: Bool) async throws {
        let _: EmptyResponse = try await send("/groups/membership", method: "POST", body: ["groupId": id, "joined": joined])
    }
    func createGroup(name: String, category: String) async throws -> CommunityGroup {
        struct Response: Decodable { let group: CommunityGroup }
        let result: Response = try await send("/groups", method: "POST", body: ["name": name, "category": category, "description": "A new DanzStak community group.", "communityStandards": true])
        return result.group
    }
    func deleteGroup(_ id: String) async throws {
        guard UUID(uuidString: id) != nil else { throw URLError(.badURL) }
        let _: EmptyResponse = try await send("/groups/" + id, method: "DELETE")
    }
    func reportGroup(_ id: String, details: String) async throws {
        let _: EmptyResponse = try await send("/reports", method: "POST", body: ["targetType": "group", "groupId": id, "reason": "other", "details": details])
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
    struct MessageUpload: Decodable { let uploadUrl: String; let mediaKey: String; let mediaType: String }
    func uploadMessageMedia(file: URL, contentType: String) async throws -> MessageUpload {
        let size = try file.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
        guard size > 0, size <= 100 * 1024 * 1024 else { throw URLError(.dataLengthExceedsMaximum) }
        let ticket: MessageUpload = try await send("/stories", method: "POST", body: ["purpose": "message", "contentType": contentType])
        guard let url = URL(string: ticket.uploadUrl), url.scheme == "https", url.host?.hasSuffix(".amazonaws.com") == true, ticket.mediaKey.hasPrefix("messages/") else { throw URLError(.badURL) }
        var request = URLRequest(url: url); request.httpMethod = "PUT"; request.timeoutInterval = 90
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        let (_, response) = try await session.upload(for: request, fromFile: file, delegate: MessageUploadRedirectGuard())
        guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else { throw URLError(.badServerResponse) }
        return ticket
    }
    func chatSettings(contact: String, muted: Bool? = nil, seconds: Int? = nil) async throws -> ChatSettings {
        struct Response: Decodable { let settings: ChatSettings }
        var body: [String: Any] = ["action": "settings", "contactEmail": contact]
        if let muted { body["muted"] = muted }; if let seconds { body["disappearingSeconds"] = seconds }
        let result: Response = try await send("/messages", method: "POST", body: body)
        return result.settings
    }
    func deleteChat(contact: String) async throws {
        var components = URLComponents(); components.queryItems = [URLQueryItem(name: "contact", value: contact)]
        let _: EmptyResponse = try await send("/messages/delete" + (components.string ?? ""), method: "POST", body: ["removeSentMedia": true])
    }
    func sendMessage(to contact: String, text: String, mediaKey: String = "", mediaType: String = "") async throws -> ChatMessage {
        let result: SentChatMessage = try await send("/messages", method: "POST", body: ["recipientEmail": contact, "content": text, "mediaKey": mediaKey, "mediaType": mediaType])
        return result.message
    }
    func deleteMessage(contact: String, message: String, scope: String) async throws {
        let _: EmptyResponse = try await send("/messages", method: "POST", body: ["action": "delete", "contactEmail": contact, "messageId": message, "scope": scope])
    }
    func editMessage(contact: String, message: String, text: String) async throws -> ChatMessage {
        let result: SentChatMessage = try await send("/messages", method: "POST", body: ["action": "edit", "contactEmail": contact, "messageId": message, "content": text])
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
    var muted: Bool? = nil
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
    var content: String
    let createdAt: String
    var editedAt: String? = nil
    var deletedAt: String? = nil
    var reactionCounts: [String: Int]? = nil
    var myReaction: String? = nil
    var mediaType: String? = nil
    var mediaUrl: String? = nil
    var expiresAt: Int? = nil
    var id: String { messageId }
}
struct ChatMessages: Decodable {
    let messages: [ChatMessage]
    let nextCursor: String?
    let canContact: Bool
    var windowStart: String? = nil
    var windowEnd: String? = nil
}
private struct ChatConversations: Decodable { let conversations: [ChatConversation] }
private struct ChatDirectory: Decodable { let users: [ChatContact] }
private struct SentChatMessage: Decodable { let message: ChatMessage }

private final class MessageUploadRedirectGuard: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

struct ChatSettings: Decodable { let muted: Bool; let disappearingSeconds: Int }
