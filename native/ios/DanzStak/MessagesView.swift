import SwiftUI

@MainActor
final class ChatsModel: ObservableObject {
    @Published var conversations: [ChatConversation] = []
    @Published var contacts: [ChatContact] = []
    @Published var error = ""
    @Published var expired = false
    @Published var loading = false
    let isDemo: Bool
    let api = APIClient()
    init(isDemo: Bool) { self.isDemo = isDemo }
    func load() async {
        guard !loading else { return }
        loading = true; error = ""
        defer { loading = false }
        if isDemo {
            if conversations.isEmpty { conversations = [ChatConversation(contactEmail: "preview-jamie", name: "Jamie Rivera", preview: "Ready for the next set?", unread: 1), ChatConversation(contactEmail: "preview-alex", name: "Alex Morgan", preview: "Let’s make something worth showing up for.")] }
            contacts = [ChatContact(email: "preview-jamie", name: "Jamie Rivera"), ChatContact(email: "preview-alex", name: "Alex Morgan")]
            return
        }
        do { conversations = try await api.conversations(); contacts = try await api.chatContacts() }
        catch APIClient.Failure.sessionExpired { expired = true }
        catch { self.error = "Chats could not be loaded. Pull down to retry." }
    }
}

struct MessagesView: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.dismiss) private var dismiss
    @StateObject private var chats: ChatsModel
    @State private var query = ""
    @State private var newChat = false
    @State private var alertStatus = ""
    @State private var selected: ChatConversation?
    init(isDemo: Bool) { _chats = StateObject(wrappedValue: ChatsModel(isDemo: isDemo)) }
    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button("Enable message sounds", systemImage: "bell.badge") {
                        Task {
                            do { alertStatus = try await MessageAlerts.shared.enable() ? "Message alerts are enabled while this build is open. Closed-app push delivery is still being configured." : "Notifications are off. You can enable them in iOS Settings." }
                            catch { alertStatus = "Notification settings could not be updated." }
                        }
                    }
                    if !alertStatus.isEmpty { Text(alertStatus).font(.caption).foregroundStyle(.secondary) }
                }
                if chats.isDemo { Text("Preview chats · No messages are sent").font(.caption).foregroundStyle(.secondary) }
                if !chats.error.isEmpty { Text(chats.error).foregroundStyle(.red) }
                if chats.loading && chats.conversations.isEmpty { ProgressView("Loading chats…") }
                ForEach(chats.conversations.filter { query.isEmpty || $0.name.localizedCaseInsensitiveContains(query) || $0.preview.localizedCaseInsensitiveContains(query) }) { chat in
                    Button { selected = chat } label: {
                        HStack(spacing: 13) {
                            ChatAvatar(name: chat.name, picture: chat.picture)
                            VStack(alignment: .leading, spacing: 6) {
                                HStack { Text(chat.name).font(.headline).foregroundStyle(.primary); Spacer(); if let date = ISO8601DateFormatter().date(from: chat.updatedAt) { Text(date, style: .time).font(.caption).foregroundStyle(.secondary) } }
                                HStack {
                                    Text(chat.preview).lineLimit(2).font(.subheadline).foregroundStyle(.secondary)
                                    Spacer()
                                    if chat.unread > 0 { Text("\(chat.unread)").font(.caption.bold()).foregroundStyle(.white).padding(6).background(Color.orange, in: Circle()) }
                                }
                            }
                        }.padding(.vertical, 9)
                    }.accessibilityIdentifier("chat.\(chat.id)")
                }
                if !chats.loading && chats.conversations.isEmpty && chats.error.isEmpty { ContentUnavailableView("Your conversations start here", systemImage: "bubble.left.and.bubble.right", description: Text("Start a chat with a friend or someone in your Tribes.")) }
            }.listStyle(.plain).navigationTitle("Chats").searchable(text: $query, prompt: "Search chats")
                .tint(.orange)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) { Button("Done") { dismiss() } }
                    ToolbarItem(placement: .topBarTrailing) { Button("New chat", systemImage: "square.and.pencil") { newChat = true }.accessibilityIdentifier("chats.new") }
                }
                .task { await chats.load() }.refreshable { await chats.load() }
                .navigationDestination(item: $selected) { chat in ChatThreadView(chat: chat, isDemo: chats.isDemo).environmentObject(app) }
                .sheet(isPresented: $newChat) {
                    NavigationStack {
                        List(chats.contacts) { contact in Button { newChat = false; selected = contact.conversation } label: { HStack { ChatAvatar(name: contact.name, picture: contact.picture); Text(contact.name).foregroundStyle(.primary) } } }
                            .overlay { if chats.contacts.isEmpty { ContentUnavailableView("No contacts available", systemImage: "person.2", description: Text("Add friends or join a Tribe to start a conversation.")) } }
                            .navigationTitle("New chat").toolbar { Button("Cancel") { newChat = false } }
                    }
                }
                .onChange(of: chats.expired) { _, expired in if expired { app.expireSession(); dismiss() } }
        }
    }
}

extension ChatConversation: Hashable {
    static func == (lhs: ChatConversation, rhs: ChatConversation) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

private struct ChatAvatar: View {
    let name: String
    var picture: String? = nil
    var body: some View {
        Group {
            if let picture, let url = URL(string: picture), url.scheme == "https" {
                AsyncImage(url: url) { image in image.resizable().scaledToFill() } placeholder: { initials }
            } else { initials }
        }.frame(width: 50, height: 50).clipShape(Circle())
    }
    private var initials: some View { Text(name.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined()).font(.headline).foregroundStyle(.orange).frame(maxWidth: .infinity, maxHeight: .infinity).background(Color.orange.opacity(0.12)) }
}

private struct ChatThreadView: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.scenePhase) private var phase
    let chat: ChatConversation
    let isDemo: Bool
    @State private var messages: [ChatMessage] = []
    @State private var draft = ""
    @State private var sending = false
    @State private var loading = false
    @State private var error = ""
    @State private var nextCursor: String?
    @State private var canContact = true
    @State private var reactionTarget: ChatMessage?
    private let api = APIClient()
    private var draftKey: String { "danzstak.chatDraft.\(isDemo ? "preview" : "live").\(chat.id)" }
    var body: some View {
        VStack(spacing: 0) {
            if isDemo { Text("Preview · Messages stay in this screen").font(.caption).padding(7).frame(maxWidth: .infinity).background(Color.orange.opacity(0.12)) }
            if !error.isEmpty { HStack { Text(error).font(.caption); Button("Retry") { Task { await load() } } }.padding(8).foregroundStyle(.red) }
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 10) {
                        if nextCursor != nil { Button("Load earlier messages") { Task { await load(earlier: true) } }.disabled(loading) }
                        if messages.isEmpty { Text("Say hello to \(chat.name)").font(.footnote).foregroundStyle(.secondary).padding(.top, 24) }
                        ForEach(messages) { message in
                            let own = message.senderEmail.lowercased() != chat.contactEmail.lowercased()
                            HStack {
                                if own { Spacer(minLength: 50) }
                                VStack(alignment: .trailing, spacing: 5) {
                                    Text(message.content).frame(maxWidth: .infinity, alignment: .leading).textSelection(.enabled)
                                    HStack(spacing: 5) {
                                        if let date = ISO8601DateFormatter().date(from: message.createdAt) { Text(date, style: .time).font(.caption2).foregroundStyle(.secondary) }
                                        if let counts = message.reactionCounts { ForEach(counts.keys.sorted(), id: \.self) { emoji in Text("\(emoji) \(counts[emoji] ?? 0)").font(.caption) } }
                                    }
                                }.padding(12).background(own ? Color.orange.opacity(0.17) : Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 17))
                                    .contextMenu { ForEach(["👍", "❤️", "😂", "😮", "😢", "😡"], id: \.self) { emoji in Button(emoji) { Task { await react(message, emoji: emoji) } } }; if message.myReaction?.isEmpty == false { Button("Remove reaction") { Task { await react(message, emoji: "") } } } }
                                if !own { Spacer(minLength: 50) }
                            }.id(message.id).accessibilityIdentifier("chat.message")
                        }
                        Color.clear.frame(height: 1).id("chat.bottom")
                    }.padding(.horizontal, 14).padding(.vertical, 14)
                }.background(Color(uiColor: .systemGroupedBackground))
                    .onChange(of: messages.last?.id) { _, _ in withAnimation { proxy.scrollTo("chat.bottom", anchor: .bottom) } }
            }
            if !canContact { Text("You can read this conversation. Sending requires an accepted friendship or a shared Tribe.").font(.footnote).padding() }
            HStack(alignment: .bottom, spacing: 10) {
                TextField("Message", text: $draft, axis: .vertical).lineLimit(1...5).padding(12).background(Color(uiColor: .tertiarySystemFill), in: RoundedRectangle(cornerRadius: 24)).accessibilityIdentifier("chat.composer")
                Button { Task { await send() } } label: { Image(systemName: "arrow.up").font(.title3.bold()).foregroundStyle(.white).frame(width: 44, height: 44).background(.orange, in: Circle()) }
                    .disabled(sending || !canContact || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || draft.count > 2000).accessibilityLabel("Send message")
            }.padding(12).background(.bar)
        }.navigationBarTitleDisplayMode(.inline).toolbar { ToolbarItem(placement: .principal) { HStack(spacing: 10) { ChatAvatar(name: chat.name, picture: chat.picture).scaleEffect(0.7).frame(width: 36, height: 36); Text(chat.name).font(.headline).lineLimit(1) } } }
            .task {
                draft = UserDefaults.standard.string(forKey: draftKey) ?? ""
                await load()
                while !Task.isCancelled { try? await Task.sleep(for: .seconds(10)); if phase == .active && !Task.isCancelled { await load() } }
            }.onChange(of: draft) { _, text in UserDefaults.standard.set(text, forKey: draftKey) }
    }
    private func load(earlier: Bool = false) async {
        guard !loading, !sending else { return }; loading = true
        defer { loading = false }
        if isDemo {
            if messages.isEmpty { messages = [ChatMessage(messageId: "preview-hello", senderEmail: chat.contactEmail, recipientEmail: "preview-you", content: chat.preview.isEmpty ? "Hey! What are you working on?" : chat.preview, createdAt: ISO8601DateFormatter().string(from: Date()))] }
            return
        }
        do {
            let result = try await api.messages(chat.contactEmail, before: earlier ? nextCursor : nil)
            guard !Task.isCancelled else { return }
            if earlier { let ids = Set(messages.map(\.id)); messages = result.messages.filter { !ids.contains($0.id) } + messages }
            else { let ids = Set(result.messages.map(\.id)); messages = messages.filter { !ids.contains($0.id) } + result.messages }
            if earlier || nextCursor == nil { nextCursor = result.nextCursor?.isEmpty == false ? result.nextCursor : nil }
            canContact = result.canContact; error = ""
        } catch APIClient.Failure.sessionExpired { app.expireSession() }
        catch { self.error = "Messages could not be loaded." }
    }
    private func send() async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !sending, canContact, !text.isEmpty, text.count <= 2000 else { return }
        sending = true; error = ""
        defer { sending = false }
        do {
            let message = isDemo ? ChatMessage(messageId: UUID().uuidString, senderEmail: "preview-you", recipientEmail: chat.contactEmail, content: text, createdAt: ISO8601DateFormatter().string(from: Date())) : try await api.sendMessage(to: chat.contactEmail, text: text)
            messages.append(message); draft = ""
        } catch APIClient.Failure.sessionExpired { app.expireSession() }
        catch { self.error = "Message could not be sent. Your draft is saved." }
    }
    private func react(_ message: ChatMessage, emoji: String) async {
        if isDemo { if let index = messages.firstIndex(where: { $0.id == message.id }) { messages[index].myReaction = emoji; messages[index].reactionCounts = emoji.isEmpty ? [:] : [emoji: 1] }; return }
        do { try await api.reactToMessage(contact: chat.contactEmail, message: message.id, reaction: emoji); await load() }
        catch APIClient.Failure.sessionExpired { app.expireSession() }
        catch { self.error = "Reaction could not be saved." }
    }
}
