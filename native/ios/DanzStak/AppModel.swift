import AuthenticationServices
import Combine
import CryptoKit
import Foundation
import UIKit

struct MediaResponder: Identifiable {
    let id: String
    let name: String
    let picture: String?
    let text: String
}

struct MediaActivity {
    var reaction: String?
    var likes: [MediaResponder] = []
    var comments: [MediaResponder] = []
    var shares: [MediaResponder] = []
}

@MainActor
final class AppModel: NSObject, ObservableObject, ASWebAuthenticationPresentationContextProviding {
    @Published var posts: [FeedPost] = []
    @Published var status = ""
    @Published var signedIn = SessionStore.load() != nil
    @Published var isDemo = false
    @Published var isLoading = false
    @Published var groups: [CommunityGroup] = []
    @Published var stories: [FeedStory] = []
    @Published var reels: [FeedReel] = []
    @Published var mediaActivity: [String: MediaActivity] = [:]
    @Published var postShareCounts: [String: Int] = [:]
    @Published var storiesError = ""
    @Published var storiesLoading = false
    @Published var notices: [FeedNotice] = []
    @Published var engagement: [String: Engagement] = [:]
    @Published var postErrors: [String: String] = [:]
    @Published var busyPosts: Set<String> = []
    @Published var communityError = ""
    @Published var noticesError = ""
    private var sessionEpoch = 0
    private let api = APIClient()
    private var webSession: ASWebAuthenticationSession?

    private var savedPostsKey: String { "native.saved." + (isDemo ? "preview" : SHA256.hash(data: Data((SessionStore.load() ?? "signed-out").utf8)).map { String(format: "%02x", $0) }.joined()) }
    func isPostSaved(_ id: String) -> Bool { (UserDefaults.standard.stringArray(forKey: savedPostsKey) ?? []).contains(id) }
    func toggleSavedPost(_ id: String) {
        var ids = Set(UserDefaults.standard.stringArray(forKey: savedPostsKey) ?? [])
        if ids.contains(id) { ids.remove(id) } else { ids.insert(id) }
        objectWillChange.send(); UserDefaults.standard.set(ids.sorted(), forKey: savedPostsKey)
    }
    func start() async {
        if ProcessInfo.processInfo.arguments.contains("--ui-preview"), !signedIn { enterDemo(); return }
        guard signedIn else { status = "Log in to see Your Mix."; return }
        if posts.isEmpty { posts = api.cachedPosts() }
        await refresh()
    }

    func login() {
        webSession?.cancel()
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
        guard signedIn, !isDemo, !isLoading else { return }
        let epoch = sessionEpoch
        isLoading = true
        defer { if epoch == sessionEpoch { isLoading = false } }
        status = "Loading Your Mix…"
        do {
            guard try await api.validSession() else { throw APIClient.Failure.sessionExpired }
            let loaded = try await api.posts()
            guard epoch == sessionEpoch else { return }
            posts = loaded
            status = posts.isEmpty ? "Your Mix is ready. Be the first to post." : "\(posts.count) posts"
        } catch APIClient.Failure.sessionExpired {
            if epoch == sessionEpoch { expireSession() }
        } catch { if epoch == sessionEpoch { status = "Your Mix could not be loaded. Please try again." } }
    }

    func publish(_ text: String, location: String = "", tagged: [TaggedMember] = []) async -> Bool {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return false }
        guard signedIn, text.count <= 5000 else { return false }
        if isDemo {
            let id = UUID().uuidString
            posts.insert(FeedPost(id: id, author: "You", text: text, createdAt: ISO8601DateFormatter().string(from: Date()), isOwner: true, location: location, taggedUsers: tagged), at: 0)
            engagement[id] = Engagement()
            status = "Demo post added on this device only."
            return true
        }
        let epoch = sessionEpoch
        status = "Publishing…"
        do {
            let postID = try await api.publish(text, location: location)
            if !tagged.isEmpty {
                do { try await api.editTags(postID, members: tagged.map(\.memberId), location: location) }
                catch {
                    await refresh()
                    guard epoch == sessionEpoch else { return true }
                    status = "Post published, but people tags could not be saved. Open Tags & location on the post to retry."
                    return true
                }
            }
            guard epoch == sessionEpoch else { return false }
            await refresh()
            return true
        } catch APIClient.Failure.sessionExpired {
            if epoch == sessionEpoch { expireSession() }
        } catch { if epoch == sessionEpoch { status = "Post could not be published. Your draft is saved." } }
        return false
    }

    func updateTags(_ post: FeedPost, members: [TaggedMember], location: String, removeMine: Bool = false) async throws {
        let epoch = sessionEpoch
        do {
            if !isDemo {
                if removeMine { try await api.removeMyTag(post.id) }
                else { try await api.editTags(post.id, members: members.map(\.memberId), location: location) }
            }
            guard epoch == sessionEpoch else { return }
            if let index = posts.firstIndex(where: { $0.id == post.id }) {
                posts[index].taggedUsers = removeMine ? (posts[index].taggedUsers ?? []).filter { $0.isMe != true } : members
                if !removeMine { posts[index].location = location }
            }
        } catch APIClient.Failure.sessionExpired { if epoch == sessionEpoch { expireSession() }; throw APIClient.Failure.sessionExpired }
    }

    func expireSession() {
        APIClient.clearFeedCache()
        sessionEpoch += 1
        signedIn = false
        SessionStore.clear()
        clearContent()
        status = "Your session expired. Log in again."
    }

    func logout() async {
        APIClient.clearFeedCache()
        webSession?.cancel()
        let demo = isDemo
        sessionEpoch += 1
        signedIn = false
        isDemo = false
        clearContent()
        if !demo { try? await api.logout(); SessionStore.clear() }
        status = "Signed out."
    }

    private func clearContent() {
        posts = []; groups = []; stories = []; reels = []; mediaActivity = [:]; postShareCounts = [:]; storiesError = ""; storiesLoading = false; notices = []; engagement = [:]
        postErrors = [:]; busyPosts = []; communityError = ""; noticesError = ""; isLoading = false
    }

    func enterDemo() {
        webSession?.cancel()
        UserDefaults.standard.removeObject(forKey: "danzstak.demoDraft")
        sessionEpoch += 1
        clearContent()
        isDemo = true
        signedIn = true
        let now = ISO8601DateFormatter().string(from: Date())
        let previewName = ProcessInfo.processInfo.arguments.contains("--long-name-preview") ? "Alexandra Christine Montgomery-Williams" : "You"
        posts = [
            FeedPost(id: "demo-1", author: "DanzStak Community", text: "A place for the people who move music forward.\n\nShare your next set, find your scene, and make something worth showing up for.", createdAt: now),
            FeedPost(id: "demo-2", author: "The Night Shift", text: "What’s the one track you always come back to? Drop it in the comments. 🎧", createdAt: now),
            FeedPost(id: "demo-3", author: previewName, text: "Ready to find my people. See you on the dance floor. ✨", createdAt: now, isOwner: true),
            FeedPost(id: "demo-4", author: "Studio Notes", text: "A little practice, a fresh idea, and a track that won’t leave your head. What are you working on today?", createdAt: now),
            FeedPost(id: "demo-5", author: "Local Scenes", text: "Support the people building something in your city. The next great night starts with your community.", createdAt: now)
        ]
        groups = [CommunityGroup(id: "demo-djs", name: "DJs & Producers", category: "Music makers", description: "Talk tracks, trade ideas, and find your next collaborator."), CommunityGroup(id: "demo-scene", name: "Local Scenes", category: "Community", description: "The people and places that keep your city moving.")]
        if ProcessInfo.processInfo.arguments.contains("--tagging-preview") {
            posts[0].mediaUrl = "https://www.danzstak.com/assets/danzstak-logo.png"
            posts[0].mediaType = "image"
            posts[0].taggedUsers = [TaggedMember(memberId: "demo-me", name: "Tagged preview user", isMe: true)]
        }
        stories = [
            FeedStory(storyId: "demo-s1", displayName: "DanzStak", caption: "Find your people. Feel your scene."),
            FeedStory(storyId: "demo-s2", displayName: "The Night Shift", caption: "One more track. One more moment."),
            FeedStory(storyId: "demo-s3", displayName: "Local Scenes", caption: "Music brings us together.")
        ]
        reels = [FeedReel(id: "demo-r1", caption: "In the mix", displayName: "DanzStak"), FeedReel(id: "demo-r2", caption: "Behind the sound", displayName: "Studio Notes"), FeedReel(id: "demo-r3", caption: "Find your scene", displayName: "Local Scenes")]
        notices = [FeedNotice(type: "comment", postId: "demo-3", preview: "Welcome to the community!", createdAt: now, unread: true)]
        for post in posts { engagement[post.id] = Engagement() }
        status = "Demo mode • Sample content. Nothing is sent to DanzStak."
    }

    func loadEngagement(_ id: String, force: Bool = false) async {
        guard signedIn, !isDemo, force || engagement[id] == nil else { return }
        let epoch = sessionEpoch
        do {
            let result = try await api.engagement(id)
            guard epoch == sessionEpoch else { return }
            engagement[id] = result; postErrors[id] = nil
        } catch APIClient.Failure.sessionExpired { if epoch == sessionEpoch { expireSession() } }
        catch { if epoch == sessionEpoch { postErrors[id] = "Could not load activity. Try again." } }
    }

    func react(_ id: String) async {
        guard signedIn, !busyPosts.contains(id), let current = engagement[id] else { return }
        if isDemo {
            var next = current
            let liked = current.myReaction == "Like"
            next.myReaction = liked ? "" : "Like"
            next.reactionCounts["Like"] = max(0, (current.reactionCounts["Like"] ?? 0) + (liked ? -1 : 1))
            engagement[id] = next
            return
        }
        let epoch = sessionEpoch
        busyPosts.insert(id)
        defer { if epoch == sessionEpoch { busyPosts.remove(id) } }
        do {
            try await api.react(id, reaction: current.myReaction == "Like" ? "" : "Like")
            if epoch == sessionEpoch { await loadEngagement(id, force: true) }
        } catch APIClient.Failure.sessionExpired { if epoch == sessionEpoch { expireSession() } }
        catch { if epoch == sessionEpoch { postErrors[id] = "Reaction could not be saved. Try again." } }
    }

    func comment(_ id: String, text: String) async -> Bool {
        guard signedIn, !busyPosts.contains(id), !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, text.count <= 1000 else { return false }
        if isDemo {
            var detail = engagement[id] ?? Engagement()
            detail.comments.append(FeedComment(commentId: UUID().uuidString, authorName: "You", content: text, createdAt: ISO8601DateFormatter().string(from: Date())))
            engagement[id] = detail
            return true
        }
        let epoch = sessionEpoch
        busyPosts.insert(id)
        defer { if epoch == sessionEpoch { busyPosts.remove(id) } }
        do {
            try await api.comment(id, text: text)
            guard epoch == sessionEpoch else { return false }
            await loadEngagement(id, force: true)
            return true
        } catch APIClient.Failure.sessionExpired { if epoch == sessionEpoch { expireSession() } }
        catch { if epoch == sessionEpoch { postErrors[id] = "Comment could not be sent. Your draft is saved." } }
        return false
    }

    func loadGroups() async {
        guard signedIn, !isDemo else { return }
        let epoch = sessionEpoch
        communityError = ""
        do { let result = try await api.groups(); if epoch == sessionEpoch { groups = result } }
        catch APIClient.Failure.sessionExpired { if epoch == sessionEpoch { expireSession() } }
        catch { if epoch == sessionEpoch { communityError = "Tribes could not be loaded. Pull down to retry." } }
    }

    func loadStories() async {
        guard signedIn, !isDemo, !storiesLoading else { return }
        let epoch = sessionEpoch
        storiesLoading = true
        storiesError = ""
        defer { if epoch == sessionEpoch { storiesLoading = false } }
        do {
            let result = try await api.stories()
            if epoch == sessionEpoch { stories = result.stories; reels = result.reels ?? [] }
        } catch {
            // Optional story-service failures must not invalidate a healthy feed session.
            if epoch == sessionEpoch { storiesError = "Flashes couldn’t be loaded. Tap Retry." }
        }
    }

    private func currentMediaResponder(text: String) -> MediaResponder {
        let profile = posts.first { $0.isOwner == true }
        return MediaResponder(id: UUID().uuidString, name: profile?.author ?? "You", picture: profile?.authorPicture, text: text)
    }

    func reactToMedia(_ id: String, emoji: String) {
        var activity = mediaActivity[id] ?? MediaActivity()
        let newReaction = activity.reaction == emoji ? nil : emoji
        activity.reaction = newReaction
        activity.likes = newReaction.map { [currentMediaResponder(text: $0)] } ?? []
        mediaActivity[id] = activity
    }

    func commentOnMedia(_ id: String, text: String) -> Bool {
        let content = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty, content.count <= 1000 else { return false }
        var activity = mediaActivity[id] ?? MediaActivity()
        activity.comments.append(currentMediaResponder(text: content))
        mediaActivity[id] = activity
        return true
    }

    func recordMediaShare(_ id: String) {
        var activity = mediaActivity[id] ?? MediaActivity()
        activity.shares.append(currentMediaResponder(text: "Shared"))
        mediaActivity[id] = activity
    }

    func recordPostShare(_ id: String) { postShareCounts[id, default: 0] += 1 }

    func loadNotices() async {
        guard signedIn, !isDemo else { return }
        let epoch = sessionEpoch
        noticesError = ""
        do { let result = try await api.notices(); if epoch == sessionEpoch { notices = result } }
        catch APIClient.Failure.sessionExpired { if epoch == sessionEpoch { expireSession() } }
        catch { if epoch == sessionEpoch { noticesError = "Notifications could not be loaded. Pull down to retry." } }
    }

    func markNoticesRead() async {
        if isDemo { notices = notices.map { var item = $0; item.unread = false; return item }; return }
        let epoch = sessionEpoch
        do { try await api.markNoticesRead(); if epoch == sessionEpoch { await loadNotices() } }
        catch APIClient.Failure.sessionExpired { if epoch == sessionEpoch { expireSession() } }
        catch { if epoch == sessionEpoch { noticesError = "Could not mark notifications as read. Try again." } }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first ?? UIWindow()
    }

    private func finishLogin(code: String, verifier: String) async {
        let epoch = sessionEpoch
        guard !isDemo else { return }
        status = "Finishing secure login…"
        do {
            let token = try await api.exchange(code: code, verifier: verifier)
            guard epoch == sessionEpoch else { return }
            try SessionStore.save(token)
            signedIn = true
            await refresh()
        } catch { status = "Secure login could not be completed." }
    }
}
