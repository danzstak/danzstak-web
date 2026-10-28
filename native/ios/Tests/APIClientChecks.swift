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
        var captured = request
        if captured.httpBody == nil, let stream = captured.httpBodyStream {
            stream.open(); defer { stream.close() }
            var data = Data(), buffer = [UInt8](repeating: 0, count: 1024)
            while stream.hasBytesAvailable {
                let count = stream.read(&buffer, maxLength: buffer.count)
                if count <= 0 { break }
                data.append(buffer, count: count)
            }
            captured.httpBody = data
        }
        Self.requests.append(captured)
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

        StubProtocol.payload = #"{"posts":[{"postId":"1","authorName":"Test","content":"Hello","createdAt":"2026-10-27","location":"Berlin","taggedUsers":[{"memberId":"member-1","name":"Friend","isMe":true}]}]}"#
        let posts = try await api.posts()
        precondition(posts.count == 1 && posts[0].text == "Hello")
        precondition(posts[0].location == "Berlin" && posts[0].taggedUsers?.first?.isMe == true)
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
        StubProtocol.status = 201
        StubProtocol.payload = #"{"postId":"new-post"}"#
        let published = try await api.publish("Hello", location: "Berlin")
        precondition(published == "new-post")
        precondition(StubProtocol.requests.last?.httpMethod == "POST")
        precondition(StubProtocol.requests.last?.url?.path == "/secure-posts")
        StubProtocol.payload = "{}"
        try await api.editTags("new-post", members: ["friend-id"], location: "Berlin")
        precondition(StubProtocol.requests.last?.httpMethod == "PATCH")
        let editBody = try JSONSerialization.jsonObject(with: StubProtocol.requests.last!.httpBody!) as! [String: Any]
        precondition(editBody["location"] as? String == "Berlin")
        try await api.removeMyTag("new-post")
        let removeBody = try JSONSerialization.jsonObject(with: StubProtocol.requests.last!.httpBody!) as! [String: Any]
        precondition(removeBody["removeOwnTag"] as? Bool == true)
        StubProtocol.payload = #"{"allowTags":false,"onlineVisible":false,"darkMode":true,"language":"de"}"#
        let settings = try await api.taggingSettings()
        precondition(!settings.allowTags)
        StubProtocol.payload = "{}"
        try await api.saveTaggingSettings(settings)
        let settingsBody = try JSONSerialization.jsonObject(with: StubProtocol.requests.last!.httpBody!) as! [String: Any]
        precondition(settingsBody["allowTags"] as? Bool == false && settingsBody["darkMode"] as? Bool == true && settingsBody["language"] as? String == "de")
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
        let rootBody = try JSONSerialization.jsonObject(with: StubProtocol.requests.last!.httpBody!) as! [String: Any]
        precondition(rootBody["parentCommentId"] == nil)
        StubProtocol.payload = #"{"comment":{"commentId":"c2","parentCommentId":"c1"}}"#
        let replyAck = try await api.comment("post1", text: "A reply", parentCommentID: "c1")
        let replyBody = try JSONSerialization.jsonObject(with: StubProtocol.requests.last!.httpBody!) as! [String: Any]
        precondition(replyBody["parentCommentId"] as? String == "c1" && replyAck?.parentCommentId == "c1")
        StubProtocol.payload = #"{"reactionCounts":{},"myReaction":"","commentRepliesSupported":true,"comments":[{"commentId":"c2","parentCommentId":"c1","replyToName":"Member","authorName":"You","content":"A reply","createdAt":"2026-10-28"}]}"#
        let threaded = try await api.engagement("post1")
        precondition(threaded.commentRepliesSupported == true && threaded.comments.first?.parentCommentId == "c1")
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
        StubProtocol.payload = #"{"conversations":[{"contactEmail":"friend@example.com","name":"Friend","preview":"Hello","updatedAt":"2026-10-28","unread":2,"canContact":true}]}"#
        let chats = try await api.conversations()
        precondition(chats.first?.unread == 2)
        StubProtocol.payload = #"{"messages":[{"messageId":"message-1","senderEmail":"friend@example.com","recipientEmail":"me@example.com","content":"Hello","createdAt":"2026-10-28"}],"nextCursor":"","canContact":true}"#
        let thread = try await api.messages("friend+music@example.com")
        precondition(thread.messages.first?.content == "Hello")
        let parameters = URLComponents(url: StubProtocol.requests.last!.url!, resolvingAgainstBaseURL: false)!.queryItems!
        precondition(parameters.first { $0.name == "contact" }?.value == "friend+music@example.com")
        precondition(parameters.first { $0.name == "read" }?.value == "1")
        StubProtocol.payload = #"{"message":{"messageId":"message-2","senderEmail":"me@example.com","recipientEmail":"friend@example.com","content":"Hey","createdAt":"2026-10-28"}}"#
        let sent = try await api.sendMessage(to: "friend@example.com", text: "Hey")
        precondition(sent.content == "Hey")
        let messageBody = try JSONSerialization.jsonObject(with: StubProtocol.requests.last!.httpBody!) as! [String: Any]
        precondition(messageBody["recipientEmail"] as? String == "friend@example.com")
        StubProtocol.payload = "{}"
        try await api.reactToMessage(contact: "friend@example.com", message: "message-2", reaction: "👍")
        StubProtocol.payload = #"{"message":{"messageId":"message-2","senderEmail":"me@example.com","recipientEmail":"friend@example.com","content":"Fixed","createdAt":"2026-10-28","editedAt":"2026-10-28"}}"#
        let edited = try await api.editMessage(contact: "friend@example.com", message: "message-2", text: "Fixed")
        precondition(edited.content == "Fixed" && edited.editedAt != nil)
        StubProtocol.payload = "{}"
        try await api.deleteMessage(contact: "friend@example.com", message: "message-2", scope: "me")
        let deletionBody = try JSONSerialization.jsonObject(with: StubProtocol.requests.last!.httpBody!) as! [String: Any]
        precondition(deletionBody["scope"] as? String == "me" && deletionBody["messageId"] as? String == "message-2")
        StubProtocol.status = 401
        do { _ = try await api.messages("friend@example.com"); fatalError("Chat 401 must expire session") }
        catch APIClient.Failure.sessionExpired {}
        StubProtocol.status = 200
        StubProtocol.payload = #"{"groupIds":["default-0","default-6"]}"#
        let memberships = try await api.groupMemberships()
        precondition(memberships == ["default-0", "default-6"])
        precondition(CommunityGroup.defaults.count == 10)
        let uploadFile = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try Data([1,2,3]).write(to: uploadFile)
        defer { try? FileManager.default.removeItem(at: uploadFile) }
        StubProtocol.payload = #"{"uploadUrl":"https://media.s3.us-west-1.amazonaws.com/messages/test/file.mp4","mediaKey":"messages/test/file.mp4","mediaType":"video"}"#
        let upload = try await api.uploadMessageMedia(file: uploadFile, contentType: "video/mp4")
        precondition(upload.mediaType == "video")
        precondition(StubProtocol.requests.last?.httpMethod == "PUT")
        precondition(StubProtocol.requests.last?.value(forHTTPHeaderField: "Authorization") == nil)
        StubProtocol.payload = #"{"settings":{"muted":true,"disappearingSeconds":86400}}"#
        let chatPreferences = try await api.chatSettings(contact: "friend@example.com", muted: true, seconds: 86400)
        precondition(chatPreferences.muted && chatPreferences.disappearingSeconds == 86400)
        StubProtocol.payload = "{}"
        try await api.deleteChat(contact: "friend+music@example.com")
        let deleteBody = try JSONSerialization.jsonObject(with: StubProtocol.requests.last!.httpBody!) as! [String: Any]
        precondition(deleteBody["removeSentMedia"] as? Bool == true)
        print("API checks passed: feed, sessions, recovery, exchange, publish, logout, engagement, query encoding, comments, reactions, groups, notices, HTTPS.")
    }
}
