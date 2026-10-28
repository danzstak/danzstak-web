import SwiftUI
import AVKit

private enum SocialStyle {
    static let blue = Color(red: 0.16, green: 0.32, blue: 0.93)
    static let canvas = Color(uiColor: .systemGroupedBackground)
    static let card = Color(uiColor: .secondarySystemGroupedBackground)
}

private enum SocialTab: String, CaseIterable {
    case home = "Home", people = "People", create = "Create", alerts = "Alerts", profile = "Profile"
    var icon: String {
        switch self {
        case .home: "house.fill"
        case .people: "person.2.fill"
        case .create: "plus.app.fill"
        case .alerts: "bell.fill"
        case .profile: "person.crop.circle"
        }
    }
}

struct ContentView: View {
    @EnvironmentObject private var model: AppModel
    @State private var selection: SocialTab = .home
    @State private var composer = false
    @State private var searching = false
    @State private var query = ""
    @State private var showGroups = false

    var body: some View {
        Group {
            if model.signedIn {
                VStack(spacing: 0) {
                    if model.isDemo {
                        HStack {
                            Label("DEMO · Sample content", systemImage: "eye")
                            Spacer()
                            Button("Exit") { Task { await model.logout() } }
                        }
                        .font(.caption.weight(.semibold)).padding(.horizontal, 16).padding(.vertical, 8)
                        .background(Color.yellow.opacity(0.18))
                    }
                TabView(selection: $selection) {
                    NavigationStack { home }.tag(SocialTab.home).tabItem { Label("Home", systemImage: "house.fill") }
                    NavigationStack { people }.tag(SocialTab.people).tabItem { Label("People", systemImage: "person.2.fill") }
                    NavigationStack { composerLanding }.tag(SocialTab.create).tabItem { Label("Create", systemImage: "plus.app.fill") }
                    NavigationStack { alerts }.tag(SocialTab.alerts).tabItem { Label("Alerts", systemImage: "bell.fill") }
                        .badge(model.notices.filter(\.unread).count)
                    NavigationStack { profile }.tag(SocialTab.profile).tabItem { Label("Profile", systemImage: "person.crop.circle") }
                }
                .tint(SocialStyle.blue)
                }
                .sheet(isPresented: $composer) { ComposerView(isDemo: model.isDemo).environmentObject(model) }
                .sheet(isPresented: $showGroups) { NavigationStack { groups }.environmentObject(model) }
            } else { welcome }
        }
        .tint(SocialStyle.blue)
        .task { await model.start() }
        .onChange(of: model.signedIn) { _, signedIn in
            if !signedIn { selection = .home; composer = false; showGroups = false; query = "" }
        }
    }

    private var welcome: some View {
        VStack(alignment: .leading, spacing: 26) {
            Spacer()
            Image(systemName: "waveform.path").font(.system(size: 56, weight: .bold)).foregroundStyle(SocialStyle.blue)
            Text("DanzStak").font(.system(size: 46, weight: .heavy, design: .rounded)).tracking(-2)
            Text("Find your people.\nFeel your scene.").font(.largeTitle.bold())
            Text("Music, moments, and the people who make them. Your community starts here.")
                .font(.title3).foregroundStyle(.secondary)
            Spacer()
            Button { model.login() } label: {
                Text("Log in to DanzStak").font(.headline).frame(maxWidth: .infinity).padding(10)
            }.buttonStyle(.borderedProminent).controlSize(.large)
            Button("Explore the demo") { model.enterDemo() }.frame(maxWidth: .infinity).padding(6)
            Text(model.status.isEmpty ? "Sign in securely with your DanzStak account." : model.status)
                .font(.footnote).foregroundStyle(.secondary)
            Spacer().frame(height: 8)
        }.padding(28).frame(maxWidth: 600).frame(maxWidth: .infinity).background(SocialStyle.canvas)
    }

    private var home: some View {
        VStack(spacing: 0) {
            HStack {
                Image("DanzStakBrand")
                    .resizable().scaledToFit().frame(width: 168, height: 112)
                    .accessibilityLabel("DanzStak")
                    .accessibilityIdentifier("danzstak.brand")
                Spacer()
                Button { searching.toggle(); if !searching { query = "" } } label: {
                    Image(systemName: "magnifyingglass").font(.title3.weight(.semibold))
                        .foregroundStyle(.white).frame(width: 44, height: 44)
                        .background(.white.opacity(0.12), in: Circle())
                }.accessibilityLabel("Search feed")
            }
            .padding(.horizontal, 18).padding(.vertical, 2)
            .background(.black)
        ScrollView {
            LazyVStack(spacing: 12) {
                if searching {
                    HStack {
                        Image(systemName: "magnifyingglass")
                        TextField("Search loaded posts and people", text: $query).textInputAutocapitalization(.never)
                        Button { query = ""; searching = false } label: { Image(systemName: "xmark.circle.fill") }
                    }.padding(14).background(SocialStyle.card, in: RoundedRectangle(cornerRadius: 16)).padding(.horizontal, 16)
                }
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("YOUR COMMUNITY").font(.caption2.bold()).tracking(1.5).foregroundStyle(SocialStyle.blue)
                        Text("Good to see you.").font(.title2.bold())
                    }
                    Spacer()
                    Button { showGroups = true } label: { Label("Groups", systemImage: "person.3").font(.subheadline.weight(.semibold)) }
                        .buttonStyle(.bordered).clipShape(Capsule())
                }.padding(.horizontal, 18).padding(.top, 12)
                Button { composer = true } label: {
                    HStack(spacing: 12) {
                        Avatar(name: "You", size: 44)
                        Text("What’s happening in your world?").font(.subheadline).foregroundStyle(.secondary)
                        Spacer(minLength: 0)
                        Image(systemName: "square.and.pencil").foregroundStyle(SocialStyle.blue)
                    }.padding(16).background(SocialStyle.card, in: RoundedRectangle(cornerRadius: 18))
                }.buttonStyle(.plain).padding(.horizontal, 16)
                HStack {
                    Text(query.isEmpty ? "Your feed" : "Search results").font(.headline)
                    Spacer()
                    if model.isLoading { ProgressView() }
                    else { Label("Latest", systemImage: "line.3.horizontal.decrease").font(.caption).foregroundStyle(.secondary) }
                }.padding(.horizontal, 18).padding(.top, 6)
                if model.status.contains("could not") {
                    VStack(spacing: 8) {
                        Text(model.status).font(.footnote)
                        Button("Try again") { Task { await model.refresh() } }
                    }.padding().frame(maxWidth: .infinity).background(SocialStyle.card)
                }
                if filteredPosts.isEmpty, !model.isLoading {
                    EmptyState(icon: query.isEmpty ? "text.bubble" : "magnifyingglass", title: query.isEmpty ? "Start the conversation" : "No matching posts", detail: query.isEmpty ? "Share a thought, a track, or a moment with your community." : "Try another name or phrase. Search covers the posts loaded in your feed.")
                }
                ForEach(filteredPosts) { post in PostCard(post: post) }
            }.padding(.bottom, 16).frame(maxWidth: 760).frame(maxWidth: .infinity)
        }
        .background(SocialStyle.canvas).refreshable { await model.refresh() }
        }
        .toolbar(.hidden, for: .navigationBar)
    }

    private var filteredPosts: [FeedPost] {
        model.posts.filter { query.isEmpty || $0.text.localizedCaseInsensitiveContains(query) || $0.author.localizedCaseInsensitiveContains(query) }
    }

    private var peoplePosts: [FeedPost] {
        var seen = Set<String>()
        return model.posts.filter { post in
            let key = post.userEmail ?? post.author
            return post.isOwner != true && seen.insert(key).inserted
        }
    }

    private var people: some View {
        List {
            Section {
                Text("Discover the people sharing in your feed. Open a member to see their loaded posts.")
                    .foregroundStyle(.secondary).listRowBackground(Color.clear)
            }
            Section("People in your feed") {
                ForEach(peoplePosts) { person in
                    NavigationLink {
                        ScrollView {
                            LazyVStack(spacing: 12) {
                                ProfileHeader(name: person.author, picture: person.authorPicture, subtitle: "DanzStak community member")
                                ForEach(model.posts.filter { ($0.userEmail ?? $0.author) == (person.userEmail ?? person.author) }) { post in PostCard(post: post) }
                            }
                        }.background(SocialStyle.canvas).navigationTitle(person.author).navigationBarTitleDisplayMode(.inline)
                    } label: {
                        HStack(spacing: 12) {
                            Avatar(name: person.author, picture: person.authorPicture, size: 50)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(person.author).font(.headline)
                                Text("View posts").font(.caption).foregroundStyle(.secondary)
                            }.padding(.vertical, 8)
                        }
                    }
                }
                if peoplePosts.isEmpty { Text("People will appear here when your feed loads.").foregroundStyle(.secondary) }
            }
            Section {
                Button { showGroups = true } label: { Label("Explore community groups", systemImage: "person.3.fill") }
            }
        }.navigationTitle("People")
    }

    private var composerLanding: some View {
        VStack(spacing: 24) {
            Image(systemName: "square.and.pencil").font(.system(size: 48)).foregroundStyle(SocialStyle.blue)
            Text("Your voice belongs here.").font(.title2.bold())
            Text("Share a thought or an update with the community.").foregroundStyle(.secondary).multilineTextAlignment(.center)
            Button("Create a post") { composer = true }.buttonStyle(.borderedProminent).controlSize(.large)
        }.padding(30).frame(maxWidth: .infinity, maxHeight: .infinity).background(SocialStyle.canvas).navigationTitle("Create")
    }

    private var alerts: some View {
        List {
            if !model.noticesError.isEmpty { Text(model.noticesError).foregroundStyle(.secondary) }
            if model.notices.isEmpty {
                EmptyState(icon: "bell.badge", title: "You’re all caught up", detail: "Reactions and comments on your posts will appear here.").listRowBackground(Color.clear)
            }
            ForEach(model.notices) { notice in
                NavigationLink {
                    ScrollView {
                        if let post = model.posts.first(where: { $0.id == notice.postId }) { PostCard(post: post) }
                        else { EmptyState(icon: "text.bubble", title: "Post isn’t in your feed", detail: "Refresh Home to load recent posts. The post may also have been removed or made private.") }
                    }.background(SocialStyle.canvas).navigationTitle("Post")
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: notice.type == "comment" ? "bubble.left.fill" : "hand.thumbsup.fill")
                            .foregroundStyle(SocialStyle.blue).frame(width: 42, height: 42).background(SocialStyle.blue.opacity(0.1), in: Circle())
                        VStack(alignment: .leading, spacing: 5) {
                            Text(notice.type == "comment" ? "New comment on your post" : "New reaction to your post").font(.subheadline.weight(.semibold))
                            Text(notice.preview).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                            PostDate(value: notice.createdAt)
                        }
                        if notice.unread { Circle().fill(SocialStyle.blue).frame(width: 8, height: 8).accessibilityLabel("Unread") }
                    }.padding(.vertical, 5)
                }
            }
        }.navigationTitle("Notifications").task { await model.loadNotices() }.refreshable { await model.loadNotices() }
        .toolbar { Button("Mark read") { Task { await model.markNoticesRead() } }.disabled(!model.notices.contains(where: \.unread)) }
    }

    private var profile: some View {
        ScrollView {
            VStack(spacing: 16) {
                ProfileHeader(name: myPost?.author ?? "Your profile", picture: myPost?.authorPicture, subtitle: "Part of the DanzStak community")
                HStack(spacing: 12) {
                    Button { composer = true } label: { Label("Create post", systemImage: "plus") }.buttonStyle(.borderedProminent)
                    Button { showGroups = true } label: { Label("Groups", systemImage: "person.3") }.buttonStyle(.bordered)
                }
                HStack { Text("Your posts").font(.title3.bold()); Spacer() }.padding(.horizontal, 18)
                if model.posts.filter({ $0.isOwner == true }).isEmpty {
                    EmptyState(icon: "square.and.pencil", title: "Make your first post", detail: "Your posts from the loaded feed appear here.")
                }
                ForEach(model.posts.filter { $0.isOwner == true }) { post in PostCard(post: post) }
                VStack(alignment: .leading, spacing: 18) {
                    Link(destination: URL(string: "https://www.danzstak.com/privacy.html")!) { Label("Privacy policy", systemImage: "hand.raised") }
                    Link(destination: URL(string: "https://www.danzstak.com/terms.html")!) { Label("Terms of service", systemImage: "doc.text") }
                    Button(role: .destructive) { Task { await model.logout() } } label: { Label(model.isDemo ? "Exit demo" : "Log out", systemImage: "rectangle.portrait.and.arrow.right") }
                }.frame(maxWidth: .infinity, alignment: .leading).padding(20).background(SocialStyle.card, in: RoundedRectangle(cornerRadius: 18)).padding(.horizontal, 16)
            }.padding(.bottom, 24).frame(maxWidth: 760).frame(maxWidth: .infinity)
        }.background(SocialStyle.canvas).navigationTitle("Profile").navigationBarTitleDisplayMode(.inline)
    }

    private var myPost: FeedPost? { model.posts.first { $0.isOwner == true } }

    private var groups: some View {
        List {
            if !model.communityError.isEmpty { Text(model.communityError).foregroundStyle(.secondary) }
            if model.groups.isEmpty { EmptyState(icon: "person.3", title: "Find your community", detail: "Available DanzStak groups will appear here.") }
            ForEach(model.groups) { group in
                VStack(alignment: .leading, spacing: 10) {
                    Label(group.category, systemImage: "waveform").font(.caption.weight(.semibold)).foregroundStyle(SocialStyle.blue)
                    Text(group.name).font(.title3.bold())
                    Text(group.description).font(.subheadline).foregroundStyle(.secondary)
                }.padding(.vertical, 12)
            }
        }.navigationTitle("Groups").task { await model.loadGroups() }.refreshable { await model.loadGroups() }
        .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { showGroups = false } } }
    }
}

private struct Avatar: View {
    let name: String
    var picture: String? = nil
    var size: CGFloat = 42
    private var initials: String { String(name.split(separator: " ").prefix(2).compactMap(\.first)) }
    var body: some View {
        ZStack {
            Circle().fill(LinearGradient(colors: [SocialStyle.blue, .purple], startPoint: .topLeading, endPoint: .bottomTrailing))
            Text(initials).font(.system(size: size * 0.33, weight: .bold)).foregroundStyle(.white)
            if let picture, let url = URL(string: picture), url.scheme == "https" {
                AsyncImage(url: url) { image in image.resizable().scaledToFill() } placeholder: { Color.clear }
            }
        }.frame(width: size, height: size).clipShape(Circle()).accessibilityHidden(true)
    }
}

private struct ProfileHeader: View {
    let name: String
    var picture: String? = nil
    let subtitle: String
    var body: some View {
        VStack(spacing: 0) {
            ZStack(alignment: .trailing) {
                LinearGradient(colors: [SocialStyle.blue, Color(red: 0.39, green: 0.2, blue: 0.72)], startPoint: .leading, endPoint: .bottomTrailing)
                Image(systemName: "waveform.path").font(.system(size: 90, weight: .ultraLight)).foregroundStyle(.white.opacity(0.2)).padding(24)
            }.frame(height: 125)
            VStack(spacing: 9) {
                Avatar(name: name, picture: picture, size: 86).overlay(Circle().stroke(SocialStyle.card, lineWidth: 5)).padding(.top, -43)
                Text(name).font(.title2.bold())
                Text(subtitle).font(.subheadline).foregroundStyle(.secondary)
            }.padding(.bottom, 22).frame(maxWidth: .infinity).background(SocialStyle.card)
        }
    }
}

private struct PostDate: View {
    let value: String
    var body: some View {
        Group {
            if let date = ISO8601DateFormatter().date(from: value) ?? fractional.date(from: value) {
                Text(date, style: .relative)
            } else { Text("Recent post") }
        }.font(.caption).foregroundStyle(.secondary)
    }
    private var fractional: ISO8601DateFormatter {
        let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return formatter
    }
}

private struct PostCard: View {
    @EnvironmentObject private var model: AppModel
    let post: FeedPost
    @State private var comments = false
    private var activity: Engagement? { model.engagement[post.id] }
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                Avatar(name: post.author, picture: post.authorPicture)
                VStack(alignment: .leading, spacing: 4) {
                    Text(post.author).font(.subheadline.weight(.bold))
                    HStack(spacing: 5) { PostDate(value: post.createdAt); Text("·").foregroundStyle(.secondary); Image(systemName: "person.2").font(.caption2).foregroundStyle(.secondary) }
                }
                Spacer()
                ShareLink(item: post.text + "\n\nShared from DanzStak") { Image(systemName: "ellipsis").padding(8) }.accessibilityLabel("Share post")
            }.padding(.horizontal, 18).padding(.top, 16)
            if !post.text.isEmpty { Text(post.text).font(.body).lineSpacing(4).textSelection(.enabled).padding(.horizontal, 18).fixedSize(horizontal: false, vertical: true) }
            if let value = post.mediaUrl, let url = URL(string: value), url.scheme == "https" {
                if post.mediaType?.hasPrefix("image") == true {
                    AsyncImage(url: url) { image in image.resizable().scaledToFit() } placeholder: { ProgressView().frame(height: 180) }.frame(maxWidth: .infinity)
                } else if post.mediaType?.hasPrefix("video") == true { PostVideo(url: url) }
            }
            if let activity {
                HStack {
                    Label("\(activity.total)", systemImage: "hand.thumbsup.fill").foregroundStyle(SocialStyle.blue)
                    Spacer()
                    Button("\(activity.comments.count) comments") { comments = true }.foregroundStyle(.secondary)
                }.font(.caption).padding(.horizontal, 18)
            }
            if let error = model.postErrors[post.id] {
                HStack {
                    Text(error).font(.caption).foregroundStyle(.secondary)
                    Spacer()
                    Button("Retry") { Task { await model.loadEngagement(post.id, force: true) } }.font(.caption.bold())
                }.padding(.horizontal, 18)
            }
            Divider().padding(.horizontal, 18)
            HStack(spacing: 0) {
                Button { Task { await model.react(post.id) } } label: {
                    Label(activity?.myReaction == "Like" ? "Liked" : "Like", systemImage: activity?.myReaction == "Like" ? "hand.thumbsup.fill" : "hand.thumbsup")
                        .frame(maxWidth: .infinity)
                }.disabled(activity == nil || model.busyPosts.contains(post.id))
                Button { comments = true } label: { Label("Comment", systemImage: "bubble.left").frame(maxWidth: .infinity) }
                ShareLink(item: post.text + "\n\nShared from DanzStak") { Label("Share", systemImage: "square.and.arrow.up").frame(maxWidth: .infinity) }
            }.font(.subheadline.weight(.semibold)).padding(.horizontal, 10).padding(.bottom, 16)
        }.background(SocialStyle.card).clipShape(RoundedRectangle(cornerRadius: 16)).padding(.horizontal, 12)
        .task { await model.loadEngagement(post.id) }
        .sheet(isPresented: $comments) { CommentsView(post: post).environmentObject(model) }
    }
}

private struct PostVideo: View {
    let url: URL
    @State private var player: AVPlayer?
    var body: some View {
        VideoPlayer(player: player).frame(height: 230)
            .onAppear { player = AVPlayer(url: url) }.onDisappear { player?.pause(); player = nil }
    }
}

private struct CommentsView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let post: FeedPost
    @State private var draft = ""
    var body: some View {
        NavigationStack {
            List {
                Text(post.text).font(.subheadline).foregroundStyle(.secondary)
                if let error = model.postErrors[post.id] { Text(error).foregroundStyle(.secondary) }
                if let detail = model.engagement[post.id] {
                    if detail.comments.isEmpty { Text("Be the first to comment.").foregroundStyle(.secondary) }
                    ForEach(detail.comments) { comment in
                        HStack(alignment: .top, spacing: 10) {
                            Avatar(name: comment.authorName, size: 34)
                            VStack(alignment: .leading, spacing: 6) {
                                Text(comment.authorName).font(.subheadline.bold())
                                Text(comment.content)
                                PostDate(value: comment.createdAt)
                            }.padding(.vertical, 6)
                        }
                    }
                } else { ProgressView("Loading comments…") }
            }
            .safeAreaInset(edge: .bottom) {
                HStack(alignment: .bottom) {
                    TextField("Write a comment…", text: $draft, axis: .vertical).lineLimit(1...5).textFieldStyle(.roundedBorder)
                    Button { let text = draft; Task { if await model.comment(post.id, text: text), draft == text { draft = "" } } } label: { Image(systemName: "paperplane.fill").padding(8) }
                        .accessibilityLabel("Send comment")
                        .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || draft.count > 1000 || model.busyPosts.contains(post.id))
                }.padding().background(.bar)
            }
            .navigationTitle("Comments").navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("Done") { dismiss() } }
            .task { await model.loadEngagement(post.id, force: true) }
            .refreshable { await model.loadEngagement(post.id, force: true) }
        }
    }
}

private struct ComposerView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @AppStorage private var draft: String
    @State private var publishing = false
    @State private var certified = false

    init(isDemo: Bool) {
        _draft = AppStorage(wrappedValue: "", isDemo ? "danzstak.demoDraft" : "danzstak.postDraft")
    }

    var body: some View {
        NavigationStack {
            ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack(spacing: 12) {
                    Avatar(name: "You", size: 48)
                    VStack(alignment: .leading, spacing: 5) {
                        Text("Your post").font(.headline)
                        Label("Public", systemImage: "globe").font(.caption).foregroundStyle(.secondary)
                    }
                }
                Toggle("I created this content or have permission to share it.", isOn: $certified).font(.footnote)
                ZStack(alignment: .topLeading) {
                    if draft.isEmpty { Text("What’s happening in your world?").font(.title3).foregroundStyle(.tertiary).padding(.top, 8).padding(.leading, 5).allowsHitTesting(false) }
                    TextEditor(text: $draft).font(.title3).scrollContentBackground(.hidden).frame(height: 200)
                }
                Text("\(draft.count) / 5,000").font(.caption).foregroundStyle(draft.count > 5000 ? .red : .secondary).frame(maxWidth: .infinity, alignment: .trailing)
                Text(model.isDemo ? "Demo post: saved in memory only, never published." : "Your post will be visible to the DanzStak community.").font(.footnote).foregroundStyle(.secondary)
                if model.status.contains("could not") { Text(model.status).font(.footnote).foregroundStyle(.red) }
            }.padding(20)
            }.scrollDismissesKeyboard(.interactively)
            .navigationTitle("Create post").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() }.disabled(publishing) }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        let text = draft; publishing = true
                        Task {
                            defer { publishing = false }
                            if await model.publish(text) { draft = ""; dismiss() }
                        }
                    } label: { if publishing { ProgressView() } else { Text("Post").bold() } }
                    .disabled(publishing || !certified || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || draft.count > 5000)
                }
            }
        }.interactiveDismissDisabled(publishing)
    }
}

private struct EmptyState: View {
    let icon: String
    let title: String
    let detail: String
    var body: some View {
        VStack(spacing: 13) {
            Image(systemName: icon).font(.system(size: 34, weight: .light)).foregroundStyle(SocialStyle.blue)
            Text(title).font(.headline)
            Text(detail).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
        }.padding(30).frame(maxWidth: .infinity)
    }
}
