import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
import AVKit
import ImageIO

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
                    ToolbarItem(placement: .principal) { HStack { Image("DanzStakMark").resizable().scaledToFit().frame(width: 38, height: 38).accessibilityLabel("DanzStak brand"); Text("Chats").font(.headline) } }
                    ToolbarItem(placement: .topBarLeading) { Button("Done") { dismiss() } }
                    ToolbarItem(placement: .topBarTrailing) { Button("New chat", systemImage: "square.and.pencil") { newChat = true }.accessibilityIdentifier("chats.new") }
                }
                .task { await chats.load() }.refreshable { await chats.load() }
                .navigationDestination(item: $selected) { chat in ChatThreadView(chat: chat, isDemo: chats.isDemo, onDeleted: { chats.conversations.removeAll { $0.id == chat.id } }).environmentObject(app) }
                .sheet(isPresented: $newChat) {
                    NavigationStack {
                        List(chats.contacts) { contact in Button { newChat = false; selected = contact.conversation } label: { HStack { ChatAvatar(name: contact.name, picture: contact.picture); Text(contact.name).foregroundStyle(.primary) } } }
                            .overlay { if chats.contacts.isEmpty { ContentUnavailableView("No contacts available", systemImage: "person.2", description: Text("Add friends or join a Tribe to start a conversation.")) } }
                            .navigationTitle("New chat").toolbar { Button("Cancel") { newChat = false } }
                    }
                }
                .onChange(of: chats.expired) { _, expired in if expired { app.expireSession(); dismiss() } }
        }.preferredColorScheme(.dark)
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
    @Environment(\.dismiss) private var dismissThread
    @EnvironmentObject private var app: AppModel
    @Environment(\.scenePhase) private var phase
    let chat: ChatConversation
    let isDemo: Bool
    var forwardedDraft: String? = nil
    var onDeleted: (() -> Void)? = nil
    @State private var actions: ChatMessage?
    @State private var pendingShare: ChatMessage?
    @State private var pendingForward: ChatMessage?
    @State private var forwarding: ChatMessage?
    @State private var sharing: ChatMessage?
    @State private var appliedForward = false
    @StateObject private var dictation = SpeechDictation()
    @State private var messages: [ChatMessage] = []
    @State private var locallyDeletedMessages: Set<String> = []
    @State private var draft = ""
    @State private var mediaSendStatus = ""
    @State private var sending = false
    @State private var loading = false
    @State private var error = ""
    @State private var nextCursor: String?
    @State private var canContact = true
    @State private var reactionTarget: ChatMessage?
    @State private var selectedIDs: Set<String> = []
    @State private var copyNotice = ""
    @State private var selecting = false
    @State private var searching = false
    @State private var messageSearch = ""
    @State private var showContact = false
    @State private var showMedia = false
    @State private var showTimer = false
    @State private var confirmDeleteChat = false
    @State private var muted = false
    @State private var timer = 0
    @State private var settingsReady = false
    @State private var savingSettings = false
    @State private var cameraPresented = false
    @State private var attachmentItem: PhotosPickerItem?
    @State private var attachment: ChatPickedFile?
    @State private var attachmentLoading = false
    @State private var sentAttachmentFiles: [URL] = []
    private let api = APIClient()
    private var draftKey: String { "danzstak.chatDraft.\(isDemo ? "preview" : "live").\(chat.id)" }
    private var visibleMessages: [ChatMessage] { messages.filter { ($0.expiresAt ?? 0) == 0 || ($0.expiresAt ?? 0) > Int(Date().timeIntervalSince1970) }.filter { messageSearch.isEmpty || $0.content.localizedCaseInsensitiveContains(messageSearch) } }
    var body: some View {
        VStack(spacing: 0) {
            if searching { HStack { TextField("Search loaded messages", text: $messageSearch); Button("Done") { searching = false; messageSearch = "" } }.padding(12) }
            if isDemo { Text("Preview · Messages stay in this screen").font(.caption).padding(7).frame(maxWidth: .infinity).background(Color.orange.opacity(0.12)) }
            if !error.isEmpty { HStack { Text(error).font(.caption); Button("Retry") { Task { await load() } } }.padding(8).foregroundStyle(.red) }
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 10) {
                        if nextCursor != nil { Button("Load earlier messages") { Task { await load(earlier: true) } }.disabled(loading) }
                        if messages.isEmpty { Text("Say hello to \(chat.name)").font(.footnote).foregroundStyle(.secondary).padding(.top, 24) }
                        ForEach(visibleMessages) { message in
                            let own = message.senderEmail.lowercased() != chat.contactEmail.lowercased()
                            HStack {
                                if own { Spacer(minLength: 50) }
                                VStack(alignment: own ? .trailing : .leading, spacing: 4) {
                                VStack(alignment: .trailing, spacing: 5) {
                                    if message.mediaUrl?.isEmpty == false { ChatAttachmentView(message: message, allowLocal: isDemo) }
                                    if !message.content.isEmpty { Text(message.content).frame(maxWidth: .infinity, alignment: .leading) }
                                    if let url = chatLink(message.content) {
                                        Link(destination: url) {
                                            VStack(alignment: .leading, spacing: 5) {
                                                Label(url.host ?? "Open link", systemImage: "link").font(.subheadline.bold())
                                                Text(url.absoluteString).font(.caption).lineLimit(2)
                                            }.padding(10).frame(maxWidth: .infinity, alignment: .leading).background(.black.opacity(0.17), in: RoundedRectangle(cornerRadius: 10))
                                        }.tint(Color(red: 0.50, green: 0.79, blue: 1))
                                    }
                                    HStack(spacing: 5) {
                                        if message.editedAt?.isEmpty == false { Text("Edited").font(.caption2).foregroundStyle(.secondary) }
                                        if let date = ISO8601DateFormatter().date(from: message.createdAt) { Text(date, style: .time).font(.caption2).foregroundStyle(.secondary) }
                                    }
                                }.foregroundStyle(.white).padding(12).background(selectedIDs.contains(message.id) ? Color(red: 0.17, green: 0.35, blue: 0.51) : own ? Color(red: 0.12, green: 0.24, blue: 0.37) : Color(red: 0.125, green: 0.17, blue: 0.20), in: RoundedRectangle(cornerRadius: 17))
                                    .contentShape(Rectangle()).onTapGesture { if selecting { if !selectedIDs.insert(message.id).inserted { selectedIDs.remove(message.id) } } }.highPriorityGesture(LongPressGesture(minimumDuration: 0.5, maximumDistance: 30).onEnded { _ in dictation.stop(); actions = message })

                                    if let counts = message.reactionCounts, counts.values.contains(where: { $0 > 0 }) {
                                        HStack(spacing: 8) {
                                            ForEach(counts.keys.sorted().filter { (counts[$0] ?? 0) > 0 }, id: \.self) { emoji in Text("\(emoji) \(counts[emoji] ?? 0)").font(.caption) }
                                        }.padding(.horizontal, 8).padding(.vertical, 3).background(Color(red: 0.125, green: 0.17, blue: 0.20), in: Capsule()).foregroundStyle(.white).accessibilityIdentifier("chat.reactions")
                                    }
                                }
                                if !own { Spacer(minLength: 50) }
                            }.id(message.id).accessibilityIdentifier("chat.message")
                        }
                        Color.clear.frame(height: 1).id("chat.bottom")
                    }.padding(.horizontal, 14).padding(.vertical, 14)
                }.background(Color(red: 0.04, green: 0.08, blue: 0.10))
                    .onChange(of: messages.last?.id) { _, _ in withAnimation { proxy.scrollTo("chat.bottom", anchor: .bottom) } }
            }
            if !canContact { Text("You can read this conversation. Sending requires an accepted friendship or a shared Tribe.").font(.footnote).padding() }
            if !dictation.error.isEmpty { Text(dictation.error).font(.caption).foregroundStyle(.orange).padding(.horizontal) }
            if selecting {
                HStack { Text("\(selectedIDs.intersection(Set(visibleMessages.map(\.id))).count) selected"); Spacer(); Button("Copy selected") { UIPasteboard.general.string = visibleMessages.filter { selectedIDs.contains($0.id) }.map { $0.content.isEmpty ? ($0.mediaType == "video" ? "[Video]" : "[Photo]") : $0.content }.joined(separator: "\n\n"); copyNotice = "Messages copied" }; Button("Done") { copyNotice = ""; selecting = false; selectedIDs = [] } }.font(.caption).padding(12)
            }
            if !copyNotice.isEmpty { Text(copyNotice).font(.caption) }
            if timer > 0 { Text("New messages disappear after " + (timer == 86400 ? "24 hours" : timer == 604800 ? "7 days" : "90 days")).font(.caption).foregroundStyle(.secondary) }
            if sending && !mediaSendStatus.isEmpty { Text(mediaSendStatus).font(.caption) }
            if attachmentLoading { ProgressView("Preparing attachment…").font(.caption) }
            if let attachment {
                HStack { Label(attachment.contentType.hasPrefix("video") ? "Video attached" : "Photo attached", systemImage: "paperclip"); Spacer(); Button("Remove") { try? FileManager.default.removeItem(at: attachment.url); self.attachment = nil; attachmentItem = nil }.disabled(sending) }.font(.caption).padding(.horizontal, 14)
            }
            HStack(alignment: .bottom, spacing: 10) {
                HStack(spacing: 6) {
                    TextField("Message", text: Binding(get: { draft }, set: { draft = limitedChatText($0) }), axis: .vertical).lineLimit(1...5).accessibilityIdentifier("chat.composer")
                    PhotosPicker(selection: $attachmentItem, matching: .any(of: [.images, .videos]), preferredItemEncoding: .compatible) { Image(systemName: "paperclip").frame(width: 28, height: 32) }.disabled(sending || attachmentLoading || !canContact).accessibilityLabel("Attach photo or video")
                    Button { if UIImagePickerController.isSourceTypeAvailable(.camera) { cameraPresented = true } else { error = "No camera is available here. Use Attach to choose a photo or video." } } label: { Image(systemName: "camera").frame(width: 28, height: 32) }.disabled(sending || attachmentLoading || !canContact).accessibilityLabel("Take photo or record video")
                }.padding(12).background(Color(uiColor: .tertiarySystemFill), in: RoundedRectangle(cornerRadius: 24))
                Button {
                    if dictation.listening { dictation.stop() }
                    else {
                        let prefix = draft.trimmingCharacters(in: .whitespacesAndNewlines)
                        Task { await dictation.start { words in
                            let text = prefix.isEmpty ? words : prefix + " " + words
                            draft = String(text.prefix(2000))
                        } }
                    }
                } label: { Image(systemName: dictation.listening ? "stop.circle.fill" : "mic.fill").font(.title3).foregroundStyle(dictation.listening ? .red : .orange).frame(width: 40, height: 44) }
                    .disabled(sending || !canContact).accessibilityLabel(dictation.listening ? "Stop dictation" : "Dictate message")
                Button { Task { await send() } } label: { Image(systemName: "arrow.up").font(.title3.bold()).foregroundStyle(.white).frame(width: 44, height: 44).background(.orange, in: Circle()) }
                    .disabled(sending || attachmentLoading || !canContact || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && attachment == nil || draft.count > 2000).accessibilityLabel("Send message")
            }.padding(12).background(.bar)
        }.navigationBarTitleDisplayMode(.inline).toolbar { ToolbarItem(placement: .principal) { HStack(spacing: 10) { ChatAvatar(name: chat.name, picture: chat.picture).scaleEffect(0.7).frame(width: 36, height: 36); Text(chat.name).font(.headline).lineLimit(1) } }; ToolbarItem(placement: .topBarTrailing) { HStack { Image("DanzStakMark").resizable().scaledToFit().frame(width: 30, height: 30).accessibilityLabel("DanzStak brand"); Menu {
                Button("View contact", systemImage: "person.crop.circle") { showContact = true }
                Button("Search", systemImage: "magnifyingglass") { searching = true }
                Button("Media", systemImage: "photo.on.rectangle") { showMedia = true }
                Button(muted ? "Unmute" : "Mute", systemImage: muted ? "bell" : "bell.slash") { Task { await saveSettings(mute: !muted) } }.disabled(!settingsReady || savingSettings)
                Button("Disappearing messages", systemImage: "timer") { showTimer = true }.disabled(!settingsReady || savingSettings)
                Button("Select messages", systemImage: "checkmark.circle") { selecting = true }
                Button("Delete chat", systemImage: "trash", role: .destructive) { confirmDeleteChat = true }
            } label: { Image(systemName: "ellipsis").frame(width: 30, height: 36) }.accessibilityLabel("Chat options") } } }
            .task {
                draft = UserDefaults.standard.string(forKey: draftKey) ?? ""
                if !appliedForward, let forwardedDraft { draft = draft.isEmpty ? forwardedDraft : draft + "\n" + forwardedDraft; appliedForward = true }
                await load()
                if isDemo { settingsReady = true }
                else { do { let settings = try await api.chatSettings(contact: chat.contactEmail); muted = settings.muted; timer = settings.disappearingSeconds; settingsReady = true } catch { self.error = "Chat settings could not be loaded." } }
                while !Task.isCancelled { try? await Task.sleep(for: .seconds(10)); if phase == .active && !Task.isCancelled { await load() } }
            }.onChange(of: draft) { _, text in let limited = limitedChatText(text); if limited != text { draft = limited }; UserDefaults.standard.set(limited, forKey: draftKey) }
            .onChange(of: phase) { _, phase in if phase == .background { dictation.stop() } }
            .onChange(of: attachmentItem) { _, item in
                guard let item else { return }
                Task {
                    attachmentLoading = true; defer { attachmentLoading = false }
                    do { if let file = try await item.loadTransferable(type: ChatPickedFile.self) { if let old = attachment { try? FileManager.default.removeItem(at: old.url) }; attachment = file } }
                    catch { self.error = "Choose a supported photo or video smaller than 100 MB." }
                }
            }
            .onDisappear { dictation.stop() }
            .sheet(item: $actions, onDismiss: {
                if let item = pendingShare { pendingShare = nil; sharing = item }
                if let item = pendingForward { pendingForward = nil; forwarding = item }
            }) { message in
                ChatMessagePanel(message: message, own: message.senderEmail.lowercased() != chat.contactEmail.lowercased(),
                    select: { selecting = true; selectedIDs.insert(message.id); actions = nil },
                    save: { text in await edit(message, text: text) },
                    react: { emoji in await react(message, emoji: emoji); actions = nil },
                    share: { pendingShare = message; actions = nil },
                    forward: { pendingForward = message; actions = nil },
                    delete: { scope in await delete(message, scope: scope) })
            }
            .sheet(isPresented: $showContact) { NavigationStack { ScrollView { MemberProfileIdentity(name: chat.name, picture: chat.picture, email: chat.contactEmail, isDemo: isDemo) }.navigationTitle("Contact").toolbar { Button("Done") { showContact = false } } } }
            .sheet(isPresented: $showMedia) { NavigationStack { ScrollView { LazyVStack { Text("Media in loaded messages").font(.caption); ForEach(visibleMessages.filter { $0.mediaUrl?.isEmpty == false }) { message in ChatAttachmentView(message: message, allowLocal: isDemo); Text(message.content).font(.caption) } }.padding() }.navigationTitle("Media").toolbar { Button("Done") { showMedia = false } } } }
            .confirmationDialog("Disappearing messages · Applies to new messages for both people", isPresented: $showTimer, titleVisibility: .visible) {
                Button("Off") { Task { await saveSettings(seconds: 0) } }; Button("24 hours") { Task { await saveSettings(seconds: 86400) } }; Button("7 days") { Task { await saveSettings(seconds: 604800) } }; Button("90 days") { Task { await saveSettings(seconds: 7776000) } }
            }
            .confirmationDialog("Delete chat and your sent media? This clears your chat and removes your sent attachments from both sides. The other person’s media is preserved.", isPresented: $confirmDeleteChat, titleVisibility: .visible) {
                Button("Delete chat", role: .destructive) { Task { await deleteConversation() } }
            }
            .fullScreenCover(isPresented: $cameraPresented) {
                ChatCameraPicker { result in
                    cameraPresented = false
                    if case .success(let file) = result { if let old = attachment { try? FileManager.default.removeItem(at: old.url) }; attachment = file }
                    else if case .failure = result { error = "The capture could not be attached. Try again." }
                }
            }
            .sheet(item: $sharing) { message in ChatShareSheet(text: message.content) }
            .sheet(item: $forwarding) { message in ChatForwardPicker(content: message.content, isDemo: isDemo).environmentObject(app) }
    }
    private func saveSettings(mute: Bool? = nil, seconds: Int? = nil) async {
        savingSettings = true; defer { savingSettings = false }
        do {
            if isDemo { if let mute { muted = mute }; if let seconds { timer = seconds } }
            else { let settings = try await api.chatSettings(contact: chat.contactEmail, muted: mute, seconds: seconds); muted = settings.muted; timer = settings.disappearingSeconds }
            if muted { MessageAlerts.shared.clear(chat.id) }
        } catch APIClient.Failure.sessionExpired { app.expireSession() }
        catch { self.error = "Chat settings could not be saved. Try again." }
    }
    private func deleteConversation() async {
        do {
            if !isDemo { try await api.deleteChat(contact: chat.contactEmail) }
            dictation.stop(); NativePlayback.shared.stop()
            if let attachment { try? FileManager.default.removeItem(at: attachment.url) }; sentAttachmentFiles.forEach { try? FileManager.default.removeItem(at: $0) }
            messages = []; draft = ""; attachment = nil; UserDefaults.standard.removeObject(forKey: draftKey); MessageAlerts.shared.clear(chat.id); onDeleted?(); dismissThread()
        } catch APIClient.Failure.sessionExpired { app.expireSession() }
        catch { self.error = "Chat deletion did not finish. Try again." }
    }
    private func load(earlier: Bool = false) async {
        guard !loading, !sending else { return }; loading = true
        defer { loading = false }
        if isDemo {
            if messages.isEmpty { messages = [ChatMessage(messageId: "preview-hello", senderEmail: chat.contactEmail, recipientEmail: "preview-you", content: chat.preview.isEmpty ? "Hey! What are you working on?" : chat.preview, createdAt: ISO8601DateFormatter().string(from: Date()))] }
            return
        }
        do {
            let previous = Set(messages.map(\.id))
            let result = try await api.messages(chat.contactEmail, before: earlier ? nextCursor : nil)
            guard !Task.isCancelled else { return }
            let visible = result.messages.filter { !locallyDeletedMessages.contains($0.id) }
            if earlier { let ids = Set(messages.map(\.id)); messages = visible.filter { !ids.contains($0.id) } + messages }
            else {
                let ids = Set(visible.map(\.id))
                let start = result.windowStart?.isEmpty == false ? result.windowStart! : (result.nextCursor ?? "")
                let complete = result.nextCursor?.isEmpty != false
                messages = messages.filter { !ids.contains($0.id) && (!previous.contains($0.id) || (!complete && !start.isEmpty && $0.id < start)) } + visible
                messages.sort { $0.id < $1.id }

            }
            if earlier || nextCursor == nil { nextCursor = result.nextCursor?.isEmpty == false ? result.nextCursor : nil }
            canContact = result.canContact; error = ""
        } catch APIClient.Failure.sessionExpired { app.expireSession() }
        catch { self.error = "Messages could not be loaded." }
    }
    private func send() async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !sending, !attachmentLoading, canContact, !text.isEmpty || attachment != nil, text.count <= 2000 else { return }
        dictation.stop(); sending = true; error = ""
        defer { sending = false; mediaSendStatus = "" }
        do {
            var message: ChatMessage
            if isDemo {
                message = ChatMessage(messageId: UUID().uuidString, senderEmail: "preview-you", recipientEmail: chat.contactEmail, content: text, createdAt: ISO8601DateFormatter().string(from: Date()), mediaType: attachment.map { $0.contentType.hasPrefix("video") ? "video" : "image" }, mediaUrl: attachment?.url.absoluteString)
                if let file = attachment { sentAttachmentFiles.append(file.url) }
            } else if let file = attachment {
                mediaSendStatus = file.contentType.hasPrefix("video/") ? "Preparing 720p video…" : "Uploading photo…"
                let prepared = file.contentType.hasPrefix("video/") ? try await prepareChatVideo720(file) : file
                defer { if prepared.url != file.url { try? FileManager.default.removeItem(at: prepared.url) } }
                mediaSendStatus = "Uploading attachment…"
                let ticket = try await api.uploadMessageMedia(file: prepared.url, contentType: prepared.contentType)
                message = try await api.sendMessage(to: chat.contactEmail, text: text, mediaKey: ticket.mediaKey, mediaType: ticket.mediaType)
                try? FileManager.default.removeItem(at: file.url)
            } else { message = try await api.sendMessage(to: chat.contactEmail, text: text) }
            messages.append(message); if draft.trimmingCharacters(in: .whitespacesAndNewlines) == text { draft = "" }; attachment = nil; attachmentItem = nil
        } catch APIClient.Failure.sessionExpired { app.expireSession() }
        catch { self.error = "Message could not be sent. Your draft is saved." }
    }
    private func delete(_ message: ChatMessage, scope: String) async -> Bool {
        do {
            if !isDemo { try await api.deleteMessage(contact: chat.contactEmail, message: message.id, scope: scope) }
            locallyDeletedMessages.insert(message.id)
            messages.removeAll { $0.id == message.id }
            return true
        } catch APIClient.Failure.sessionExpired { app.expireSession() }
        catch { self.error = "The message could not be deleted. Try again." }
        return false
    }
    private func edit(_ message: ChatMessage, text: String) async -> Bool {
        do {
            let updated = isDemo ? nil : try await api.editMessage(contact: chat.contactEmail, message: message.id, text: text)
            if let index = messages.firstIndex(where: { $0.id == message.id }) {
                messages[index].content = text
                messages[index].editedAt = updated?.editedAt ?? ISO8601DateFormatter().string(from: Date())
            }
            return true
        } catch APIClient.Failure.sessionExpired { app.expireSession() }
        catch { self.error = "The edit could not be saved. Your original message is unchanged." }
        return false
    }
    private func react(_ message: ChatMessage, emoji: String) async {
        if isDemo { if let index = messages.firstIndex(where: { $0.id == message.id }) { messages[index].myReaction = emoji; messages[index].reactionCounts = emoji.isEmpty ? [:] : [emoji: 1] }; return }
        do { try await api.reactToMessage(contact: chat.contactEmail, message: message.id, reaction: emoji); await load() }
        catch APIClient.Failure.sessionExpired { app.expireSession() }
        catch { self.error = "Reaction could not be saved." }
    }
}

private func chatLink(_ text: String) -> URL? {
    let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
    return detector?.matches(in: text, range: NSRange(text.startIndex..., in: text)).compactMap(\.url).first { $0.scheme == "https" }
}
private struct ChatShareSheet: UIViewControllerRepresentable {
    let text: String
    func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: [text], applicationActivities: nil) }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
private struct ChatForwardPicker: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.dismiss) private var dismiss
    let content: String
    let isDemo: Bool
    @State private var contacts: [ChatContact] = []
    @State private var error = ""
    var body: some View {
        NavigationStack {
            List {
                Text("Choose a contact, review your draft, then tap Send.").font(.caption).foregroundStyle(.secondary)
                if !error.isEmpty { Text(error).foregroundStyle(.red) }
                ForEach(contacts) { contact in
                    NavigationLink { ChatThreadView(chat: contact.conversation, isDemo: isDemo, forwardedDraft: content).environmentObject(app) } label: { HStack { ChatAvatar(name: contact.name, picture: contact.picture); Text(contact.name) } }
                }
            }.navigationTitle("Forward message").toolbar { Button("Done") { dismiss() } }
                .task {
                    if isDemo { contacts = [ChatContact(email: "preview-jamie", name: "Jamie Rivera"), ChatContact(email: "preview-alex", name: "Alex Morgan")]; return }
                    do { contacts = try await APIClient().chatContacts() }
                    catch APIClient.Failure.sessionExpired { app.expireSession() }
                    catch { self.error = "Contacts could not be loaded. Try again." }
                }
        }.preferredColorScheme(.dark)
    }
}

private struct ChatMessagePanel: View {
    @Environment(\.dismiss) private var dismiss
    let message: ChatMessage
    let own: Bool
    let select: () -> Void
    let save: (String) async -> Bool
    let react: (String) async -> Void
    let share: () -> Void
    let forward: () -> Void
    let delete: (String) async -> Bool
    @State private var confirmDelete = false
    private var editable: Bool { own && message.deletedAt?.isEmpty != false }
    @State private var draft: String
    @State private var saving = false
    @State private var saveError = ""
    init(message: ChatMessage, own: Bool, select: @escaping () -> Void, save: @escaping (String) async -> Bool, react: @escaping (String) async -> Void, share: @escaping () -> Void, forward: @escaping () -> Void, delete: @escaping (String) async -> Bool) {
        self.message = message; self.own = own; self.select = select; self.save = save; self.react = react; self.share = share; self.forward = forward; self.delete = delete
        _draft = State(initialValue: message.content)
    }
    var body: some View {
        NavigationStack {
            ScrollView { VStack(spacing: 18) {
                if message.deletedAt?.isEmpty != false { HStack { ForEach(["👍", "❤️", "😂", "😮", "😢", "😡"], id: \.self) { emoji in
                    Button { Task { await react(emoji) } } label: { Text(emoji).font(.title2).frame(maxWidth: .infinity, minHeight: 44) }.accessibilityLabel("React with \(emoji)")
                } }.padding(8).background(Color.white.opacity(0.07), in: Capsule()) }
                if editable { TextEditor(text: Binding(get: { draft }, set: { draft = limitedChatText($0) })).scrollContentBackground(.hidden).frame(minHeight: 110, maxHeight: 220).padding(10).background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 16)).accessibilityIdentifier("chat.edit") }
                else { Text(message.content).frame(maxWidth: .infinity, alignment: .leading) }
                Button("Select messages", systemImage: "checkmark.circle", action: select)
                if !saveError.isEmpty { Text(saveError).font(.caption).foregroundStyle(.red) }
                if message.deletedAt?.isEmpty != false { HStack(spacing: 22) {
                    Button("Copy", systemImage: "doc.on.doc") { UIPasteboard.general.string = message.content; dismiss() }
                    Button("Share", systemImage: "square.and.arrow.up", action: share)
                    Button("Forward", systemImage: "arrowshape.turn.up.right", action: forward)
                }.font(.subheadline) }
                Button("Delete for me", role: .destructive) { saving = true; Task { if await delete("me") { dismiss() }; saving = false } }.disabled(saving)
                if editable { Button("Delete for everyone", role: .destructive) { confirmDelete = true }.disabled(saving) }
                Spacer(minLength: 0)
            }.padding(18) }.background(Color(red: 0.04, green: 0.08, blue: 0.10)).navigationTitle(editable ? "Edit message" : "Message").navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(saving) }
                    if editable { ToolbarItem(placement: .confirmationAction) {
                        Button("Save") { saving = true; saveError = ""; Task { if await save(draft.trimmingCharacters(in: .whitespacesAndNewlines)) { dismiss() } else { saveError = "Could not save. Your edit is still here; try again." }; saving = false } }
                            .disabled(saving || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || draft.count > 2000)
                    } }
                }
        }.tint(Color(red: 0.50, green: 0.79, blue: 1)).preferredColorScheme(.dark).presentationDetents([.medium, .large]).interactiveDismissDisabled(saving)
            .confirmationDialog("Delete this message for everyone?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete for everyone", role: .destructive) { saving = true; Task { if await delete("everyone") { dismiss() }; saving = false } }
            }
    }
}

private func limitedChatText(_ text: String) -> String {
    var units = 0
    return String(text.prefix { character in
        let count = String(character).utf16.count
        guard units + count <= 2000 else { return false }
        units += count
        return true
    })
}

private struct ChatPickedFile: Transferable {
    let url: URL
    let contentType: String
    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(importedContentType: .data) { received in
            let size = try received.file.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
            guard size > 0, size <= 100 * 1024 * 1024 else { throw URLError(.dataLengthExceedsMaximum) }
            let type = UTType(filenameExtension: received.file.pathExtension)
            var mime = type?.preferredMIMEType ?? ""
            let supported = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime"]
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent("danzstak-chat", isDirectory: true)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let destination = directory.appendingPathComponent(UUID().uuidString).appendingPathExtension(received.file.pathExtension)
            if type?.conforms(to: .image) == true && !supported.contains(mime), let image = UIImage(contentsOfFile: received.file.path), let jpeg = image.jpegData(compressionQuality: 0.9) { try jpeg.write(to: destination); mime = "image/jpeg" }
            else { guard supported.contains(mime) else { throw URLError(.unsupportedURL) }; try FileManager.default.copyItem(at: received.file, to: destination) }
            return ChatPickedFile(url: destination, contentType: mime)
        }
    }
}
private struct ChatAttachmentView: View {
    @Environment(\.scenePhase) private var phase
    let message: ChatMessage
    let allowLocal: Bool
    @State private var player: AVPlayer?
    var body: some View {
        if let value = message.mediaUrl, let url = URL(string: value), url.scheme == "https" || allowLocal && url.isFileURL {
            if message.mediaType == "video" {
                PostVideo(url: url, fullScreen: true, autoplay: false).frame(height: 240).accessibilityLabel("Attached video")
            } else {
                if url.isFileURL, let image = UIImage(contentsOfFile: url.path) { Image(uiImage: image).resizable().scaledToFit().frame(maxHeight: 200) }
                else { ChatPhoto(url: url) }
            }
        }
    }
}

private struct ChatCameraPicker: UIViewControllerRepresentable {
    let completion: (Result<ChatPickedFile, Error>?) -> Void
    func makeCoordinator() -> Coordinator { Coordinator(completion: completion) }
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController(); picker.sourceType = .camera
        picker.mediaTypes = UIImagePickerController.availableMediaTypes(for: .camera)?.filter { [UTType.image.identifier, UTType.movie.identifier].contains($0) } ?? [UTType.image.identifier]
        picker.videoQuality = .typeMedium; picker.delegate = context.coordinator
        return picker
    }
    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}
    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let completion: (Result<ChatPickedFile, Error>?) -> Void
        init(completion: @escaping (Result<ChatPickedFile, Error>?) -> Void) { self.completion = completion }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { completion(nil) }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            do {
                if let url = info[.mediaURL] as? URL {
                    let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                    guard size > 0, size <= 100 * 1024 * 1024 else { throw URLError(.dataLengthExceedsMaximum) }
                    let destination = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension(url.pathExtension)
                    try FileManager.default.copyItem(at: url, to: destination)
                    completion(.success(ChatPickedFile(url: destination, contentType: UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "video/quicktime")))
                } else if let image = info[.originalImage] as? UIImage, let jpeg = image.jpegData(compressionQuality: 0.9) {
                    let destination = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("jpg")
                    try jpeg.write(to: destination); completion(.success(ChatPickedFile(url: destination, contentType: "image/jpeg")))
                } else { throw URLError(.cannotDecodeContentData) }
            } catch { completion(.failure(error)) }
        }
    }
}

private struct ChatPhoto: View {
    let url: URL
    @State private var image: UIImage?
    @State private var failed = false
    @State private var retry = 0
    private var key: String { (url.host ?? "") + url.path + "#" + String(retry) }
    var body: some View {
        Group {
            if let image { Image(uiImage: image).resizable().scaledToFit().accessibilityLabel("Attached photo loaded") }
            else if failed { Button("Photo could not load. Retry") { failed = false; retry += 1 } }
            else { ProgressView("Loading photo…").frame(minHeight: 120) }
        }.task(id: key) {
            guard image == nil else { return }
            do {
                let (data, response) = try await URLSession.shared.data(from: url)
                guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode, data.count <= 100 * 1024 * 1024,
                      let source = CGImageSourceCreateWithData(data as CFData, nil),
                      let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceThumbnailMaxPixelSize: 1600, kCGImageSourceCreateThumbnailWithTransform: true] as CFDictionary) else { throw URLError(.cannotDecodeContentData) }
                image = UIImage(cgImage: thumbnail)
            } catch { if !Task.isCancelled { failed = true } }
        }
    }
}

private func prepareChatVideo720(_ source: ChatPickedFile) async throws -> ChatPickedFile {
    let asset = AVURLAsset(url: source.url)
    guard let export = AVAssetExportSession(asset: asset, presetName: AVAssetExportPreset1280x720) else { throw URLError(.cannotDecodeContentData) }
    let output = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("mp4")
    export.outputURL = output; export.outputFileType = .mp4; export.shouldOptimizeForNetworkUse = true
    do {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            export.exportAsynchronously { if export.status == .completed { continuation.resume() } else { continuation.resume(throwing: export.error ?? URLError(.cannotCreateFile)) } }
        }
        return ChatPickedFile(url: output, contentType: "video/mp4")
    } catch { try? FileManager.default.removeItem(at: output); throw error }
}
