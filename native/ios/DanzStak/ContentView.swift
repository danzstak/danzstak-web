import SwiftUI
import AVKit

private enum SocialStyle {
    static let blue = Color(red: 0.16, green: 0.32, blue: 0.93)
    static let canvas = Color(uiColor: .systemGroupedBackground)
    static let card = Color(uiColor: .secondarySystemGroupedBackground)
}

private struct MediaViewerPresentedKey: EnvironmentKey { static let defaultValue = false }
private extension EnvironmentValues {
    var mediaViewerPresented: Bool {
        get { self[MediaViewerPresentedKey.self] }
        set { self[MediaViewerPresentedKey.self] = newValue }
    }
}

private enum SocialTab: String, CaseIterable {
    case home = "Home", people = "People", create = "Create", alerts = "Alerts", menu = "Menu"
    var icon: String {
        switch self {
        case .home: "house.fill"
        case .people: "person.2.fill"
        case .create: "plus.app.fill"
        case .alerts: "bell.fill"
        case .menu: "line.3.horizontal"
        }
    }
}

struct ContentView: View {
    @EnvironmentObject private var model: AppModel
    @State private var selection: SocialTab = .home
    @State private var composer = false
    @State private var searching = false
    @State private var query = ""
    @SceneStorage("danzstak.feed.position") private var feedPosition: String?
    @State private var showGroups = false
    @State private var selectedStory: FeedStory?
    @State private var viewingReels = false
    @State private var showFacebookImport = false
    @State private var showMessages = false
    @State private var pendingResponse: MediaResponsePresentation?
    @State private var drawerResponse: MediaResponsePresentation?
    @AppStorage("danzstak.responseStyle") private var responseStyle = "full"
    private let headerPercent = 6.0

    private var effectiveHeaderPercent: Double {
        let arguments = ProcessInfo.processInfo.arguments
        if arguments.contains("--ui-preview"), let index = arguments.firstIndex(of: "--header-percent"),
           arguments.indices.contains(index + 1), let value = Double(arguments[index + 1]) {
            return min(10, max(4, value))
        }
        return min(10, max(4, headerPercent))
    }

    private var headerHeight: CGFloat {
        let height = UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.screen.bounds.height }.first ?? 874
        return height * effectiveHeaderPercent / 100
    }

    private var effectiveResponseStyle: String {
        let args = ProcessInfo.processInfo.arguments
        if args.contains("--ui-preview"), let index = args.firstIndex(of: "--response-style"), args.indices.contains(index + 1) { return args[index + 1] }
        return responseStyle
    }

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
                    NavigationStack { menu }.tag(SocialTab.menu).tabItem { Label("Menu", systemImage: "line.3.horizontal") }
                }
                .tint(SocialStyle.blue)
                }
                .fullScreenCover(isPresented: $showMessages) { MessagesView(isDemo: model.isDemo).environmentObject(model) }
                .sheet(isPresented: $composer) { ComposerView(isDemo: model.isDemo).environmentObject(model) }
                .sheet(isPresented: $showGroups) { NavigationStack { groups }.environmentObject(model) }
                .fullScreenCover(item: $selectedStory, onDismiss: {
                    if let response = pendingResponse { withAnimation { drawerResponse = response }; pendingResponse = nil }
                }) { story in
                    MediaViewer(pages: viewingReels ? model.reels.map(ViewerPage.init(reel:)) : model.stories.map(ViewerPage.init(story:)), initialID: story.id, useDrawer: effectiveResponseStyle == "drawer", onOpenDrawer: { page, kind in
                        pendingResponse = MediaResponsePresentation(page: page, kind: kind)
                        selectedStory = nil
                    })
                        .id("\(viewingReels ? "reels" : "stories").\(story.id)")
                }
                .sheet(isPresented: $showFacebookImport) { FacebookImportView() }
            } else { welcome }
        }
        .tint(SocialStyle.blue)
        .environment(\.mediaViewerPresented, selectedStory != nil || drawerResponse != nil || pendingResponse != nil)
        .overlay(alignment: .leading) {
            if let response = drawerResponse {
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        Color.black.opacity(0.28).ignoresSafeArea().onTapGesture { withAnimation { drawerResponse = nil } }
                        MediaResponsesView(page: response.page, kind: response.kind, compact: true, onClose: { withAnimation { drawerResponse = nil } })
                            .environmentObject(model).frame(width: geometry.size.width * 0.30)
                            .shadow(radius: 18).transition(.move(edge: .leading))
                            .accessibilityElement(children: .contain).accessibilityIdentifier("media.responseDrawer")
                    }
                }
            }
        }
        .task { await model.start() }
        .onChange(of: model.signedIn) { _, signedIn in
            if !signedIn { feedPosition = nil; showMessages = false; selection = .home; composer = false; showGroups = false; query = ""; drawerResponse = nil; pendingResponse = nil; selectedStory = nil }
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
                    .resizable().scaledToFit().frame(width: (headerHeight - 2) * 1.5, height: headerHeight - 2)
                    .accessibilityLabel("DanzStak")
                    .accessibilityIdentifier("danzstak.brand")
                Spacer()
                Button { showFacebookImport = true } label: {
                    Image(systemName: "arrow.down.doc").font(.title3.weight(.semibold))
                        .foregroundStyle(.white).frame(width: 44, height: 44)
                }.accessibilityLabel("Import Facebook data").accessibilityIdentifier("header.facebookImport")
                Button { searching.toggle(); if !searching { query = "" } } label: {
                    Image(systemName: "magnifyingglass").font(.title3.weight(.semibold))
                        .foregroundStyle(.white).frame(width: min(40, headerHeight - 4), height: min(40, headerHeight - 4))
                        .background(.white.opacity(0.12), in: Circle())
                }.frame(width: 44, height: 44).contentShape(Rectangle()).accessibilityLabel("Search Your Mix")
                Button { showMessages = true } label: {
                    Image(systemName: "bubble.left.and.bubble.right.fill").font(.title3.weight(.semibold))
                        .foregroundStyle(.white).frame(width: 44, height: 44)
                }.accessibilityLabel("Messages").accessibilityIdentifier("header.messages")
            }
            .padding(.horizontal, 18).frame(height: headerHeight)
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
                Button { composer = true } label: {
                    HStack(spacing: 10) {
                        Avatar(name: "You", size: 32)
                        Text("What’s on your mind?").font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                        Spacer(minLength: 0)
                        Image(systemName: "square.and.pencil").foregroundStyle(SocialStyle.blue)
                    }.padding(.horizontal, 12).padding(.vertical, 9).background(SocialStyle.card, in: RoundedRectangle(cornerRadius: 14))
                }.buttonStyle(.plain).padding(.horizontal, 16).padding(.top, 8).accessibilityIdentifier("home.composer")
                HStack {
                    Text(query.isEmpty ? "Your Mix" : "Search results").font(.headline)
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
                    EmptyState(icon: query.isEmpty ? "text.bubble" : "magnifyingglass", title: query.isEmpty ? "Start the conversation" : "No matching posts", detail: query.isEmpty ? "Share a thought, a track, or a moment with your community." : "Try another name or phrase. Search covers the posts loaded in Your Mix.")
                }
                ForEach(Array(filteredPosts.enumerated()), id: \.element.id) { index, post in
                    PostCard(post: post).id(post.id)
                    if index == 0, query.isEmpty { storiesRail }
                    if index == 3, query.isEmpty { reelsRail }
                }
                if query.isEmpty, filteredPosts.isEmpty { storiesRail }
                if query.isEmpty, filteredPosts.count < 4 { reelsRail }
            }.scrollTargetLayout().padding(.bottom, 16).frame(maxWidth: 760).frame(maxWidth: .infinity)
        }
        .scrollPosition(id: Binding(get: { feedPosition }, set: { if let value = $0 { feedPosition = value } }), anchor: .top)
        .background(SocialStyle.canvas).refreshable { await model.refresh(); await model.loadStories() }
        .task { await model.loadStories() }
        }
        .toolbar(.hidden, for: .navigationBar)
    }

    private var filteredPosts: [FeedPost] {
        model.posts.filter { query.isEmpty || $0.text.localizedCaseInsensitiveContains(query) || $0.author.localizedCaseInsensitiveContains(query) }
    }

    private var storiesRail: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Flashes").font(.headline)
                Spacer()
                if model.storiesLoading { ProgressView() }
            }.padding(.horizontal, 18)
            if !model.storiesError.isEmpty {
                HStack {
                    Text(model.storiesError).font(.caption).foregroundStyle(.secondary)
                    Button("Retry") { Task { await model.loadStories() } }.font(.caption.bold())
                }.padding(.horizontal, 18)
            }
            if model.stories.isEmpty { mediaPlaceholders(name: "Flashes", icon: "camera", emptyLabel: "No flashes yet") }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(Array(model.stories.enumerated()), id: \.element.id) { index, story in
                        Button { viewingReels = false; selectedStory = story } label: {
                            ZStack(alignment: .bottomLeading) {
                                LinearGradient(colors: [index.isMultiple(of: 2) ? SocialStyle.blue : .purple, .black], startPoint: .topLeading, endPoint: .bottomTrailing)
                                if let value = story.mediaUrl, let url = URL(string: value), url.scheme == "https", story.mediaType == "image" {
                                    AsyncImage(url: url) { image in image.resizable().scaledToFill() } placeholder: { Color.clear }
                                } else {
                                    Image(systemName: story.mediaType == "video" ? "play.circle.fill" : "waveform")
                                        .font(.system(size: 34)).foregroundStyle(.white.opacity(0.65)).frame(maxWidth: .infinity, maxHeight: .infinity)
                                }
                                LinearGradient(colors: [.clear, .black.opacity(0.7)], startPoint: .center, endPoint: .bottom)
                                Text(story.displayName ?? "DanzStak member").font(.caption.bold()).foregroundStyle(.white).lineLimit(2).padding(10)
                            }.frame(width: 118, height: 164).clipShape(RoundedRectangle(cornerRadius: 14))
                        }.buttonStyle(.plain).accessibilityLabel("Open flash from \(story.displayName ?? "DanzStak member")").accessibilityIdentifier("story.\(story.id)")
                    }
                }.padding(.horizontal, 16)
            }
        }.padding(.vertical, 3).accessibilityIdentifier("home.stories")
    }

    private var reelsRail: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("The Roll", systemImage: "play.rectangle.fill").font(.title3.bold()).padding(.horizontal, 18)
            if model.reels.isEmpty {
                mediaPlaceholders(name: "The Roll", icon: "video", emptyLabel: "No videos yet")
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(model.reels) { reel in
                        Button {
                            viewingReels = true
                            selectedStory = FeedStory(storyId: reel.id)
                        } label: { ReelTile(reel: reel) }
                        .accessibilityLabel("Watch The Roll: \(reel.caption ?? "DanzStak video")")
                        .accessibilityIdentifier("reel.\(reel.id)")
                    }
                }.padding(.horizontal, 16)
            }
        }.padding(.vertical, 12).accessibilityIdentifier("home.reels")
    }

    private func mediaPlaceholders(name: String, icon: String, emptyLabel: String) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(0..<3) { index in
                    VStack(spacing: 12) {
                        Image(systemName: icon).font(.system(size: 28))
                        Text(index == 0 ? emptyLabel : "Coming into view").font(.caption).multilineTextAlignment(.center)
                    }.padding(10).frame(width: name == "Flashes" ? 118 : 210, height: name == "Flashes" ? 164 : 374).foregroundStyle(.white.opacity(0.75))
                        .background(LinearGradient(colors: [Color(red: 0.17, green: 0.23, blue: 0.33), Color(red: 0.07, green: 0.09, blue: 0.13)], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 14))
                        .accessibilityLabel("\(name) placeholder \(index + 1)")
                }
            }.padding(.horizontal, 16)
        }
    }

    private var peoplePosts: [FeedPost] {
        func identity(_ post: FeedPost) -> String { if let email = post.userEmail, !email.isEmpty { return email.lowercased() }; return post.author }
        let ownIdentities = Set(model.posts.filter { $0.isOwner == true }.map(identity))
        var seen = Set<String>()
        return model.posts.filter { post in
            let key = identity(post)
            return post.isOwner != true && !ownIdentities.contains(key) && seen.insert(key).inserted
        }
    }

    private var people: some View {
        List {
            Section {
                Text("Discover the people sharing in Your Mix. Open a member to view their profile.")
                    .foregroundStyle(.secondary).listRowBackground(Color.clear)
            }
            Section("People in Your Mix") {
                ForEach(peoplePosts) { person in
                    NavigationLink {
                        ScrollView {
                            LazyVStack(spacing: 12) {
                                MemberProfileIdentity(name: person.author, picture: person.authorPicture, email: person.userEmail, isDemo: model.isDemo)
                                ForEach(model.posts.filter { ($0.userEmail ?? $0.author) == (person.userEmail ?? person.author) }) { post in PostCard(post: post) }
                            }
                        }.background(SocialStyle.canvas).navigationTitle("").navigationBarTitleDisplayMode(.inline)
                            .toolbarBackground(.hidden, for: .navigationBar)
                            .ignoresSafeArea(edges: .top)
                    } label: {
                        HStack(spacing: 12) {
                            Avatar(name: person.author, picture: person.authorPicture, size: 50)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(person.author).font(.headline)
                                Text("View profile").font(.caption).foregroundStyle(.secondary)
                            }.padding(.vertical, 8)
                        }
                    }
                }
                if peoplePosts.isEmpty { Text("People will appear here when Your Mix loads.").foregroundStyle(.secondary) }
            }
            Section {
                Button { showGroups = true } label: { Label("Explore community tribes", systemImage: "person.3.fill") }
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
                        else { EmptyState(icon: "text.bubble", title: "Post isn’t in Your Mix", detail: "Refresh Your Mix to load recent posts. The post may also have been removed or made private.") }
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
                MemberProfileIdentity(name: myPost?.author ?? "Your profile", picture: myPost?.authorPicture, email: nil, isDemo: model.isDemo, own: true)
                HStack(spacing: 12) {
                    Button { composer = true } label: { Label("Create post", systemImage: "plus") }.buttonStyle(.borderedProminent)
                    Button { showGroups = true } label: { Label("Tribes", systemImage: "person.3") }.buttonStyle(.bordered)
                }
                NavigationLink("Edit Profile") { TaggingPrivacyView().environmentObject(model) }.buttonStyle(.bordered)
                HStack { Text("Your posts").font(.title3.bold()); Spacer() }.padding(.horizontal, 18)
                if model.posts.filter({ $0.isOwner == true }).isEmpty {
                    EmptyState(icon: "square.and.pencil", title: "Make your first post", detail: "Your loaded posts appear here.")
                }
                ForEach(model.posts.filter { $0.isOwner == true }) { post in PostCard(post: post) }
                VStack(alignment: .leading, spacing: 18) {
                    Link(destination: URL(string: "https://www.danzstak.com/privacy.html")!) { Label("Privacy policy", systemImage: "hand.raised") }
                    Link(destination: URL(string: "https://www.danzstak.com/terms.html")!) { Label("Terms of service", systemImage: "doc.text") }
                    Button(role: .destructive) { Task { await model.logout() } } label: { Label(model.isDemo ? "Exit demo" : "Log out", systemImage: "rectangle.portrait.and.arrow.right") }
                }.frame(maxWidth: .infinity, alignment: .leading).padding(20).background(SocialStyle.card, in: RoundedRectangle(cornerRadius: 18)).padding(.horizontal, 16)
            }.padding(.bottom, 24).frame(maxWidth: 760).frame(maxWidth: .infinity)
        }.background(SocialStyle.canvas).navigationTitle("").navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .ignoresSafeArea(edges: .top)
    }

    private var myPost: FeedPost? { model.posts.first { $0.isOwner == true } }

    private var menu: some View {
        ScrollView {
            VStack(spacing: 0) {
                menuRow("Your Mix", icon: "house.fill") { selection = .home }
                NavigationLink { profile } label: { menuLabel("My Profile", icon: "person.fill") }.accessibilityIdentifier("menu.profile")
                menuRow("Friends", icon: "person.2.fill") { selection = .people }
                menuRow("Tribes", icon: "person.3.fill") { showGroups = true }
                NavigationLink { mediaPosts(kind: "image", title: "Photos") } label: { menuLabel("Photos", icon: "camera.fill") }
                NavigationLink { mediaPosts(kind: "video", title: "Videos") } label: { menuLabel("Videos", icon: "play.rectangle.fill") }
                menuWebRow("Events", icon: "mic.fill", path: "feed.html#events")
                menuWebRow("Booking Agent", icon: "bus.fill", path: "booking.html")
                menuWebRow("Saved", icon: "bookmark.fill", path: "feed.html#saved")
                NavigationLink { nativeSettings } label: { menuLabel("Settings", icon: "gearshape.fill") }
                menuWebRow("Support", icon: "questionmark.circle.fill", path: "support.html")
                menuWebRow("Privacy Policy", icon: "lock.fill", path: "privacy.html")
                menuWebRow("Terms of Service", icon: "doc.text.fill", path: "terms.html")
                menuRow(model.isDemo ? "Exit demo" : "Logout", icon: "rectangle.portrait.and.arrow.right") { Task { await model.logout() } }
            }.padding(.vertical, 8).background(SocialStyle.card, in: RoundedRectangle(cornerRadius: 16)).padding(16)
        }.background(SocialStyle.canvas).navigationTitle("Menu").navigationBarTitleDisplayMode(.inline)
    }
    private func menuLabel(_ title: String, icon: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon).font(.system(size: 19, weight: .semibold)).foregroundStyle(SocialStyle.blue).frame(width: 26)
            Text(title).font(.system(size: 16, weight: .semibold)).foregroundStyle(.primary)
            Spacer()
        }.padding(.horizontal, 18).frame(minHeight: 49).contentShape(Rectangle())
    }
    private func menuRow(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { menuLabel(title, icon: icon) }.buttonStyle(.plain)
    }
    private func menuWebRow(_ title: String, icon: String, path: String) -> some View {
        Link(destination: URL(string: "https://www.danzstak.com/" + path)!) { menuLabel(title, icon: icon) }
    }
    private func mediaPosts(kind: String, title: String) -> some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                let filtered = model.posts.filter { $0.mediaType?.hasPrefix(kind) == true }
                if filtered.isEmpty { EmptyState(icon: kind == "image" ? "photo" : "video", title: "No \(title.lowercased()) in your loaded posts", detail: "Refresh Your Mix to load recent community posts.") }
                ForEach(filtered) { post in PostCard(post: post) }
            }.padding(.vertical, 12)
        }.background(SocialStyle.canvas).navigationTitle(title)
    }
    private var nativeSettings: some View {
        Form {
            Section("Account") { NavigationLink("Edit Profile") { TaggingPrivacyView().environmentObject(model) } }
            Section("Responses") {
                Picker("Response lists", selection: $responseStyle) { Text("Slide out").tag("drawer"); Text("Full screen").tag("full") }.pickerStyle(.segmented)
            }
            Section { Button("Import Facebook data") { showFacebookImport = true }; Button("Messages") { showMessages = true } }
        }.navigationTitle("Settings")
    }

    private var groups: some View {
        NativeTribesView().environmentObject(model)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { showGroups = false } } }
    }

}

private struct ReelTile: View {
    let reel: FeedReel
    var body: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(colors: [.purple, SocialStyle.blue, .black], startPoint: .topLeading, endPoint: .bottomTrailing)
            Image(systemName: "play.circle.fill").font(.system(size: 42)).foregroundStyle(.white.opacity(0.85)).frame(maxWidth: .infinity, maxHeight: .infinity)
            VStack(alignment: .leading, spacing: 5) {
                Text(reel.caption ?? "Watch The Roll").font(.subheadline.bold()).lineLimit(3)
                Text(reel.displayName ?? "DanzStak").font(.caption).opacity(0.8)
            }.foregroundStyle(.white).padding(12)
        }.frame(width: 210, height: 374).clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

private struct FacebookImportView: View {
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("1. Download your information").font(.headline)
                    Text("In Facebook, open Settings → Accounts Center → Your information and permissions. Choose Download your information or Export your information, then choose your Facebook profile and export to your device.")
                    Link("Open Facebook Accounts Center", destination: URL(string: "https://accountscenter.facebook.com/")!)
                }
                Section {
                    Text("2. Choose JSON format").font(.headline)
                    Text("Select JSON, the date range you want, and your posts, profile, photos, and videos. Request the export. When Facebook says it’s ready, download the ZIP file to your device.")
                }
                Section {
                    Text("3. Open the DanzStak importer").font(.headline)
                    Text("Open DanzStak’s website and sign in if asked. Open its menu and choose Import from Facebook. Select the ZIP or JSON file you downloaded.")
                    Link(destination: URL(string: "https://www.danzstak.com/feed.html")!) {
                        Label("Open DanzStak import tools", systemImage: "arrow.up.right.square")
                    }
                }
                Section {
                    Text("4. Review, then import").font(.headline)
                    Text("Choose the items and profile details to bring over, set the audience, and confirm you have permission to share the content. Tap Import selected when you’re ready. Imported posts default to Public, so check the audience first.")
                    Text("Your Facebook password is not needed. Nothing is uploaded from this screen.").font(.footnote).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Import Facebook data").navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("Done") { dismiss() } }
        }
    }
}

private struct ViewerPage: Identifiable {
    let id: String
    let name: String
    let caption: String
    let url: URL?
    let kind: String
    var post: FeedPost? = nil

    init(post: FeedPost) { id = post.id; name = post.author; caption = post.text; let candidate = post.mediaUrl.flatMap(URL.init(string:)); url = candidate?.scheme == "https" ? candidate : nil; kind = "video"; self.post = post }

    init(story: FeedStory) {
        id = story.id; name = story.displayName ?? "DanzStak member"; caption = story.caption ?? story.content ?? ""
        let candidate = story.mediaUrl.flatMap(URL.init(string:))
        url = candidate?.scheme == "https" ? candidate : nil
        kind = story.mediaType ?? "image"
    }

    init(reel: FeedReel) {
        id = reel.id; name = reel.displayName ?? "DanzStak"; caption = reel.caption ?? "The Roll"
        let candidate = reel.url.flatMap(URL.init(string:))
        url = candidate?.scheme == "https" ? candidate : nil
        kind = ["mp4", "mov", "m4v", "m3u8"].contains(url?.pathExtension.lowercased() ?? "") ? "video" : "external"
    }
}

private enum MediaResponseKind: String, Identifiable, CaseIterable {
    case likes = "Likes", comments = "Comments", shares = "Shares"
    var id: String { rawValue }
    var singular: String {
        switch self { case .likes: "like"; case .comments: "comment"; case .shares: "share" }
    }
    var icon: String {
        switch self { case .likes: "hand.thumbsup.fill"; case .comments: "bubble.left.fill"; case .shares: "arrowshape.turn.up.right.fill" }
    }
}

private struct MediaResponsePresentation: Identifiable {
    let page: ViewerPage
    let kind: MediaResponseKind
    var id: String { page.id + kind.rawValue }
}

private struct MediaViewer: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var model: AppModel
    let pages: [ViewerPage]
    let useDrawer: Bool
    let onOpenDrawer: (ViewerPage, MediaResponseKind) -> Void
    @State private var index: Int
    @State private var movingForward = true
    @State private var swiping = false
    @State private var pickingReaction = false
    @State private var responseKind: MediaResponseKind?
    @State private var drafts: [String: String] = [:]
    @FocusState private var commentFocused: Bool

    init(pages: [ViewerPage], initialID: String, useDrawer: Bool = false, onOpenDrawer: @escaping (ViewerPage, MediaResponseKind) -> Void = { _, _ in }) {
        self.pages = pages
        self.useDrawer = useDrawer
        self.onOpenDrawer = onOpenDrawer
        _index = State(initialValue: pages.firstIndex { $0.id == initialID } ?? 0)
    }
    private var page: ViewerPage? { pages.indices.contains(index) ? pages[index] : nil }
    private var playing: Bool { !swiping && !pickingReaction && responseKind == nil && !commentFocused }

    var body: some View {
        ZStack(alignment: .bottom) {
            GeometryReader { geometry in
                if let page {
                    ZStack {
                        media(page: page)
                            .frame(width: geometry.size.width, height: geometry.size.height)
                            .clipped().contentShape(Rectangle())
                            .id(page.id)
                            .transition(.asymmetric(insertion: .move(edge: movingForward ? .bottom : .top), removal: .move(edge: movingForward ? .top : .bottom)))
                            .accessibilityElement(children: .contain).accessibilityIdentifier("media.page.\(page.id)")
                            .simultaneousGesture(LongPressGesture(minimumDuration: 0.5).onEnded { _ in
                                commentFocused = false; pickingReaction = true
                            })
                        VStack {
                            HStack {
                                Text("\(index + 1) / \(pages.count)").font(.caption.monospacedDigit().bold())
                                    .padding(12).background(.black.opacity(0.5), in: Capsule()).accessibilityIdentifier("media.position")
                                Spacer()
                                Button("Done", systemImage: "xmark") { dismiss() }
                                    .labelStyle(.iconOnly).font(.title3.bold()).frame(width: 48, height: 48)
                                    .background(.black.opacity(0.5), in: Circle()).accessibilityLabel("Done")
                            }.padding(.top, 12)
                            Spacer()
                            HStack(alignment: .bottom) {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(page.name).font(.headline)
                                    if page.url != nil { Text(page.caption).font(.subheadline).lineLimit(3).accessibilityIdentifier("viewer.caption.\(page.id)") }
                                    Text("Swipe up for next").font(.caption).foregroundStyle(.white.opacity(0.65))
                                }.frame(maxWidth: .infinity, alignment: .leading)
                                VStack(spacing: 18) {
                                    ForEach(MediaResponseKind.allCases) { kind in
                                        Button {
                                            if kind == .likes { if let post = page.post { Task { await model.react(post.id) } } else { model.reactToMedia(page.id, emoji: "👍") } }
                                            else if useDrawer { onOpenDrawer(page, kind) }
                                            else { responseKind = kind }
                                        } label: {
                                            HStack(spacing: 7) {
                                                Image(systemName: kind.icon).font(.system(size: 24, weight: .semibold))
                                                Text("\(count(kind, pageID: page.id))").font(.caption.bold())
                                            }.frame(width: 64, height: 48)
                                        }.accessibilityLabel("\(kind.rawValue), \(count(kind, pageID: page.id))")
                                            .accessibilityIdentifier("media.\(kind.rawValue.lowercased())")
                                            .highPriorityGesture(LongPressGesture(minimumDuration: 0.5).onEnded { _ in
                                                if useDrawer { onOpenDrawer(page, kind) }
                                                else { responseKind = kind }
                                            })
                                    }
                                }
                            }.padding(.bottom, 76)
                        }.foregroundStyle(.white).padding(.horizontal, 18)
                        if pickingReaction {
                            VStack(spacing: 12) {
                                HStack(spacing: 0) {
                                    ForEach(["👍", "❤️", "😂", "😮", "😢", "🔥"], id: \.self) { emoji in
                                        Button { model.reactToMedia(page.id, emoji: emoji); pickingReaction = false } label: {
                                            Text(emoji).font(.system(size: 28)).frame(width: 46, height: 48)
                                        }.accessibilityLabel("React \(emoji)")
                                    }
                                }
                                Button("Cancel") { pickingReaction = false }.font(.caption.bold())
                            }.padding(14).background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 24))
                                .accessibilityIdentifier("media.reactionPicker")
                        }
                    }
                    .contentShape(Rectangle())
                    .simultaneousGesture(DragGesture(minimumDistance: 20)
                        .onChanged { value in if abs(value.translation.height) > abs(value.translation.width) { swiping = true } }
                        .onEnded { value in
                            defer { swiping = false }
                            guard !pickingReaction, abs(value.translation.height) > 50,
                                  abs(value.translation.height) > abs(value.translation.width) else { return }
                            let next = min(pages.count - 1, max(0, index + (value.translation.height < 0 ? 1 : -1)))
                            commentFocused = false
                            movingForward = next > index
                            withAnimation(.easeOut(duration: 0.25)) { index = next }
                        })
                }
            }
            if let page {
                HStack(spacing: 10) {
                    TextField("Write a comment…", text: Binding(get: { drafts[page.id] ?? "" }, set: { drafts[page.id] = $0 }), axis: .vertical)
                        .lineLimit(1...3).focused($commentFocused).padding(12).background(.white.opacity(0.12), in: RoundedRectangle(cornerRadius: 22))
                    Button {
                        if let post = page.post { let text = drafts[page.id] ?? ""; Task { if await model.comment(post.id, text: text) { drafts[page.id] = ""; commentFocused = false } } }
                        else if model.commentOnMedia(page.id, text: drafts[page.id] ?? "") { drafts[page.id] = ""; commentFocused = false }
                    } label: { Image(systemName: "paperplane.fill").font(.title3).frame(width: 44, height: 44) }
                        .disabled((drafts[page.id] ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || (drafts[page.id]?.count ?? 0) > 1000)
                        .accessibilityLabel("Send media comment")
                }.foregroundStyle(.white).padding(.horizontal, 14).padding(.vertical, 8).background(.black)
            }
        }
        .background(.black).ignoresSafeArea(edges: .top).preferredColorScheme(.dark).statusBarHidden()
        .fullScreenCover(item: $responseKind) { kind in
            if let page {
                if let post = page.post { if kind == .comments { CommentsView(post: post).environmentObject(model) } else { PostRespondersView(post: post, kind: kind).environmentObject(model) } }
                else { MediaResponsesView(page: page, kind: kind).environmentObject(model) }
            }
        }
        .task(id: page?.id) { if let post = page?.post { await model.loadEngagement(post.id) } }
        .onDisappear { NativePlayback.shared.stop() }
    }

    private func count(_ kind: MediaResponseKind, pageID: String) -> Int {
        if let post = pages.first(where: { $0.id == pageID })?.post {
            switch kind { case .likes: return model.engagement[post.id]?.total ?? 0; case .comments: return model.engagement[post.id]?.comments.count ?? 0; case .shares: return model.postShareCounts[post.id] ?? 0 }
        }
        let activity = model.mediaActivity[pageID] ?? MediaActivity()
        switch kind { case .likes: return activity.likes.count; case .comments: return activity.comments.count; case .shares: return activity.shares.count }
    }

    @ViewBuilder private func media(page: ViewerPage) -> some View {
        ZStack {
            LinearGradient(colors: [SocialStyle.blue.opacity(0.4), .black], startPoint: .topLeading, endPoint: .bottomTrailing)
            if let url = page.url {
                if page.kind == "video" { PostVideo(url: url, active: playing, fullScreen: true, controlsBottomInset: 64) }
                else if page.kind == "external" {
                    VStack(spacing: 20) {
                        Image(systemName: "play.rectangle").font(.system(size: 70))
                        Text("This video is hosted by \(url.host ?? "an external provider").").multilineTextAlignment(.center)
                        Link("Watch original video", destination: url).buttonStyle(.borderedProminent)
                    }.foregroundStyle(.white).padding(30)
                } else {
                    AsyncImage(url: url) { image in image.resizable().scaledToFit() } placeholder: { ProgressView().tint(.white) }
                }
            } else {
                VStack(spacing: 22) {
                    Image(systemName: "waveform").font(.system(size: 70)).foregroundStyle(.white.opacity(0.6))
                    Text(page.caption).font(.title2.bold()).multilineTextAlignment(.center).accessibilityIdentifier("viewer.caption.\(page.id)")
                    Text("Demo preview").font(.caption).foregroundStyle(.white.opacity(0.6))
                }.foregroundStyle(.white).padding(30)
            }
        }
    }
}

private struct MediaResponsesView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let page: ViewerPage
    let kind: MediaResponseKind
    var compact = false
    var onClose: (() -> Void)? = nil
    @State private var draft = ""
    @State private var sharing = false
    private var responders: [MediaResponder] {
        let activity = model.mediaActivity[page.id] ?? MediaActivity()
        switch kind { case .likes: return activity.likes; case .comments: return activity.comments; case .shares: return activity.shares }
    }
    var body: some View {
        if compact { compactPanel }
        else {
        NavigationStack {
            List {
                Section {
                    Text("Activity in this preview is saved on this device only. Community-wide responses aren’t connected yet.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                Section("\(responders.count) \(responders.count == 1 ? kind.singular : kind.rawValue.lowercased())") {
                    if responders.isEmpty { Text("No \(kind.rawValue.lowercased()) yet.").foregroundStyle(.secondary) }
                    ForEach(responders) { person in
                        HStack(alignment: .top, spacing: 12) {
                            Avatar(name: person.name, picture: person.picture, size: 44)
                            VStack(alignment: .leading, spacing: 5) {
                                Text(person.name).font(.headline).fixedSize(horizontal: false, vertical: true).accessibilityIdentifier("response.name")
                                Text(person.text).font(.body)
                            }
                        }.padding(.vertical, 6)
                    }
                }
            }
            .navigationTitle(kind.rawValue).navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { Button("Done") { if let onClose { onClose() } else { dismiss() } } }
                ToolbarItem(placement: .topBarLeading) {
                    if kind == .likes { Button("Like", systemImage: "hand.thumbsup") { model.reactToMedia(page.id, emoji: "👍") } }
                    else if kind == .shares { Button("Share", systemImage: "square.and.arrow.up") { sharing = true } }
                }
            }
            .safeAreaInset(edge: .bottom) {
                if kind == .comments {
                    HStack {
                        TextField("Write a comment…", text: $draft, axis: .vertical).lineLimit(1...4).textFieldStyle(.roundedBorder)
                        Button("Send") { if model.commentOnMedia(page.id, text: draft) { draft = "" } }
                            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || draft.count > 1000)
                    }.padding().background(.bar)
                }
            }
            .sheet(isPresented: $sharing) {
                NativeShareSheet(items: [page.caption, URL(string: "https://www.danzstak.com/feed.html")!]) { completed in
                    if completed { model.recordMediaShare(page.id) }
                }
            }
        }
        }
    }

    private var compactPanel: some View {
        VStack(spacing: 10) {
            HStack {
                Text(kind.rawValue).font(.caption.bold()).lineLimit(1)
                Spacer(minLength: 0)
                Button { onClose?() } label: { Image(systemName: "xmark").font(.caption.bold()).frame(width: 28, height: 32) }.accessibilityLabel("Done")
            }.padding(.horizontal, 8)
            Text("\(responders.count)").font(.headline)
            Text("On-device preview").font(.system(size: 10)).foregroundStyle(.secondary).multilineTextAlignment(.center)
            Divider()
            ScrollView {
                LazyVStack(spacing: 18) {
                    if responders.isEmpty { Text("No responses yet").font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center) }
                    ForEach(responders) { person in
                        VStack(spacing: 6) {
                            Avatar(name: person.name, picture: person.picture, size: 34)
                            Text(person.name).font(.caption.weight(.semibold)).lineLimit(3).multilineTextAlignment(.center)
                            Text(person.text).font(.caption2).lineLimit(4).multilineTextAlignment(.center)
                        }.frame(maxWidth: .infinity)
                    }
                }.padding(8)
            }
            if kind == .likes { Button { model.reactToMedia(page.id, emoji: "👍") } label: { Image(systemName: "hand.thumbsup").frame(width: 44, height: 44) }.accessibilityLabel("Like") }
            else if kind == .shares { Button { sharing = true } label: { Image(systemName: "square.and.arrow.up").frame(width: 44, height: 44) }.accessibilityLabel("Share") }
            else {
                TextField("Comment", text: $draft, axis: .vertical).font(.caption).lineLimit(1...3).textFieldStyle(.roundedBorder).padding(.horizontal, 6)
                Button("Send") { if model.commentOnMedia(page.id, text: draft) { draft = "" } }.font(.caption.bold())
                    .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || draft.count > 1000)
            }
        }.padding(.top, 8).padding(.bottom, 12).frame(maxHeight: .infinity).background(SocialStyle.card)
        .sheet(isPresented: $sharing) {
            NativeShareSheet(items: [page.caption, URL(string: "https://www.danzstak.com/feed.html")!]) { completed in
                if completed { model.recordMediaShare(page.id) }
            }
        }
    }
}

private struct NativeShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    let completion: (Bool) -> Void
    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
        controller.completionWithItemsHandler = { _, completed, _, _ in DispatchQueue.main.async { completion(completed) } }
        return controller
    }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
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
    @State private var sharing = false
    @State private var responseKind: MediaResponseKind?
    @State private var editingTags = false
    @State private var tagError = ""
    @State private var showingVideos = false
    private var profileVideos: [ViewerPage] { model.posts.filter { $0.mediaType?.hasPrefix("video") == true && (($0.userEmail?.isEmpty == false && post.userEmail?.isEmpty == false) ? $0.userEmail == post.userEmail : $0.author == post.author && $0.authorPicture == post.authorPicture) }.map(ViewerPage.init(post:)) }
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
                Menu {
                    Button("Share") { sharing = true }
                    if post.isOwner == true { Button("Tags & location") { editingTags = true } }
                    if post.taggedUsers?.contains(where: { $0.isMe == true }) == true { Button("Remove my tag", role: .destructive) { removeTag() } }
                } label: { Image(systemName: "ellipsis").padding(8) }.accessibilityLabel("Post options")
            }.padding(.horizontal, 18).padding(.top, 16)
            if let tags = post.taggedUsers, !tags.isEmpty {
                Label(tags.map(\.name).joined(separator: ", "), systemImage: "person.crop.circle.badge.checkmark").font(.subheadline).padding(.horizontal, 18)
            }
            if let location = post.location, !location.isEmpty { Label(location, systemImage: "mappin.and.ellipse").font(.caption).padding(.horizontal, 18) }
            if !tagError.isEmpty { Text(tagError).font(.caption).foregroundStyle(.red).padding(.horizontal, 18) }
            if !post.text.isEmpty { Text(post.text).font(.body).lineSpacing(4).textSelection(.enabled).padding(.horizontal, 18).fixedSize(horizontal: false, vertical: true) }
            if let value = post.mediaUrl, let url = URL(string: value), url.scheme == "https" {
                Group {
                if post.mediaType?.hasPrefix("image") == true {
                    AsyncImage(url: url) { image in image.resizable().scaledToFit() } placeholder: { ProgressView().frame(height: 180) }.frame(maxWidth: .infinity)
                } else if post.mediaType?.hasPrefix("video") == true { PostVideo(url: url, active: !comments && !sharing && !editingTags && !showingVideos && responseKind == nil, onOpen: { showingVideos = true }) }
                }.accessibilityIdentifier("post.media.\(post.id)").contextMenu {
                    if post.taggedUsers?.contains(where: { $0.isMe == true }) == true { Button("Remove my tag", role: .destructive) { removeTag() } }
                    if post.isOwner == true { Button("Tags & location") { editingTags = true } }
                }
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
                    HStack(spacing: 7) {
                        Image(systemName: activity?.myReaction == "Like" ? "hand.thumbsup.fill" : "hand.thumbsup")
                        Text("\(activity?.total ?? 0)").font(.caption.bold())
                    }.frame(maxWidth: .infinity, minHeight: 44)
                }.disabled(activity == nil || model.busyPosts.contains(post.id))
                    .accessibilityLabel(activity?.myReaction == "Like" ? "Liked" : "Like").accessibilityValue("\(activity?.total ?? 0)")
                    .highPriorityGesture(LongPressGesture(minimumDuration: 0.5).onEnded { _ in responseKind = .likes })
                Button { comments = true } label: {
                    HStack(spacing: 7) { Image(systemName: "bubble.left"); Text("\(activity?.comments.count ?? 0)").font(.caption.bold()) }
                        .frame(maxWidth: .infinity, minHeight: 44)
                }.accessibilityLabel("Comment").accessibilityValue("\(activity?.comments.count ?? 0)")
                    .highPriorityGesture(LongPressGesture(minimumDuration: 0.5).onEnded { _ in responseKind = .comments })
                Button { sharing = true } label: {
                    HStack(spacing: 7) { Image(systemName: "square.and.arrow.up"); Text("\(model.postShareCounts[post.id] ?? 0)").font(.caption.bold()) }
                        .frame(maxWidth: .infinity, minHeight: 44)
                }.accessibilityLabel("Share").accessibilityValue("\(model.postShareCounts[post.id] ?? 0) on this device")
                    .highPriorityGesture(LongPressGesture(minimumDuration: 0.5).onEnded { _ in responseKind = .shares })
            }.font(.title3.weight(.semibold)).padding(.horizontal, 10).padding(.bottom, 8)
            if let entries = activity?.comments, !entries.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(Array(entries.prefix(2))) { comment in
                        Button { comments = true } label: {
                            HStack(alignment: .top, spacing: 9) {
                                Avatar(name: comment.authorName, picture: comment.authorPicture, size: 32)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(comment.authorName).font(.caption.bold())
                                    Text(comment.content).font(.subheadline).lineLimit(3).multilineTextAlignment(.leading)
                                }.frame(maxWidth: .infinity, alignment: .leading)
                            }.foregroundStyle(.primary)
                        }.buttonStyle(.plain)
                    }
                    if entries.count > 2 { Button("View all \(entries.count) comments") { comments = true }.font(.subheadline.weight(.semibold)) }
                }.padding(.horizontal, 18).padding(.bottom, 14)
            }
        }.background(SocialStyle.card).clipShape(RoundedRectangle(cornerRadius: 16))
        .fullScreenCover(isPresented: $showingVideos) { MediaViewer(pages: profileVideos, initialID: post.id).environmentObject(model) }
        .sheet(isPresented: $editingTags) { PostTagEditor(post: post).environmentObject(model) }
        .task { await model.loadEngagement(post.id) }
        .fullScreenCover(isPresented: $comments) { CommentsView(post: post).environmentObject(model) }
        .fullScreenCover(item: $responseKind) { kind in
            if kind == .comments { CommentsView(post: post).environmentObject(model) }
            else { PostRespondersView(post: post, kind: kind).environmentObject(model) }
        }
        .sheet(isPresented: $sharing) {
            NativeShareSheet(items: [post.text, URL(string: "https://www.danzstak.com/feed.html")!]) { completed in
                if completed { model.recordPostShare(post.id) }
            }
        }
    }
    private func removeTag() {
        Task {
            do { try await model.updateTags(post, members: [], location: post.location ?? "", removeMine: true); tagError = "" }
            catch { tagError = "Your tag could not be removed. Try again." }
        }
    }
}

private struct PostRespondersView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let post: FeedPost
    let kind: MediaResponseKind
    private var activity: Engagement? { model.engagement[post.id] }
    private var responders: [MediaResponder] {
        let own = model.posts.first { $0.isOwner == true }
        if kind == .shares {
            let count = model.postShareCounts[post.id] ?? 0
            return count > 0 ? [MediaResponder(id: "local-share", name: own?.author ?? "You", picture: own?.authorPicture, text: "\(count) completed shares on this device")] : []
        }
        if let people = activity?.reactors {
            return people.enumerated().map { index, person in MediaResponder(id: "\(index)", name: person.name, picture: person.picture, text: person.reaction ?? "Like") }
        }
        if let reaction = activity?.myReaction, !reaction.isEmpty {
            return [MediaResponder(id: "own-reaction", name: own?.author ?? "You", picture: own?.authorPicture, text: reaction)]
        }
        return []
    }
    var body: some View {
        NavigationStack {
            List {
                if kind == .shares {
                    Text("Share activity shown here is from this device. Community-wide share identities aren’t available yet.").font(.footnote).foregroundStyle(.secondary)
                } else if !model.isDemo, activity?.reactors == nil {
                    Text("The service provides reaction totals but not the full responder list yet. Only your own known reaction can be shown.").font(.footnote).foregroundStyle(.secondary)
                }
                if responders.isEmpty { Text("No responder details available.").foregroundStyle(.secondary) }
                ForEach(responders) { person in
                    HStack(alignment: .top, spacing: 12) {
                        Avatar(name: person.name, picture: person.picture, size: 44)
                        VStack(alignment: .leading, spacing: 5) {
                            Text(person.name).font(.headline).fixedSize(horizontal: false, vertical: true)
                            Text(person.text).font(.subheadline).foregroundStyle(.secondary)
                        }
                    }.padding(.vertical, 8)
                }
            }.navigationTitle(kind.rawValue).navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("Done") { dismiss() } }
            .task { await model.loadEngagement(post.id, force: true) }
        }
    }
}

struct PostVideo: View {
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.mediaViewerPresented) private var viewerPresented
    let url: URL
    var active = true
    var fullScreen = false
    var autoplay = true
    var controlsBottomInset: CGFloat = 0
    var onOpen: (() -> Void)? = nil
    @State private var controlsVisible = true
    @State private var audioMuted = true
    @State private var pausedByUser = false
    @State private var isPlaying = false
    @State private var progress = 0.0
    @State private var duration = 1.0
    @State private var scrubbing = false
    @State private var resumeAfterScrub = false
    @State private var observer: Any?
    @State private var hideTask: Task<Void, Never>?
    @State private var player: AVPlayer?
    @State private var visible = false
    @State private var mediaWidth: CGFloat = 360
    @State private var videoAspect: CGFloat = 16.0 / 9.0
    private var shouldPlay: Bool { !pausedByUser && active && visible && scenePhase == .active && (fullScreen || !viewerPresented) }
    var body: some View {
        ZStack {
            FitVideoPlayer(player: player).contentShape(Rectangle()).onTapGesture { if let onOpen { onOpen() } else { controlsVisible.toggle(); scheduleControlsHide() } }
            if controlsVisible {
                Button {
                    guard let player else { return }
                    pausedByUser = player.rate > 0
                    if pausedByUser { NativePlayback.shared.pause(player) } else { updatePlayback() }
                    isPlaying = !pausedByUser; scheduleControlsHide()
                } label: { Image(systemName: isPlaying ? "pause.fill" : "play.fill").font(.system(size: 18)).foregroundStyle(.white).frame(width: 44, height: 44).background(.black.opacity(0.4), in: Circle()) }.accessibilityLabel(isPlaying ? "Pause video" : "Play video")
                VStack { Spacer(); Slider(value: $progress, in: 0...max(1, duration), onEditingChanged: { editing in
                    guard let player else { return }
                    scrubbing = editing
                    if editing { resumeAfterScrub = player.rate > 0; player.pause(); hideTask?.cancel() }
                    else { player.seek(to: CMTime(seconds: progress, preferredTimescale: 600)); if resumeAfterScrub { pausedByUser = false; updatePlayback() }; scheduleControlsHide() }
                }).tint(.white).accessibilityLabel("Video progress").padding(.horizontal, 12).padding(.bottom, controlsBottomInset) }
            }
        }
            .overlay(alignment: .topTrailing) {
                if !fullScreen {
                    Button { audioMuted.toggle(); player?.isMuted = audioMuted } label: {
                        Image(systemName: audioMuted ? "speaker.slash.fill" : "speaker.wave.2.fill").font(.system(size: 18)).foregroundStyle(.white).frame(width: 44, height: 44).background(.black.opacity(0.6), in: Circle())
                    }.accessibilityLabel(audioMuted ? "Unmute feed video" : "Mute feed video").padding(8)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: fullScreen ? .infinity : nil)
            .frame(height: fullScreen ? nil : mediaWidth / videoAspect)
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { if $0 > 0 { mediaWidth = $0 } }
            .onGeometryChange(for: Bool.self) { proxy in
                let frame = proxy.frame(in: .global)
                let bounds = UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.screen.bounds }.first ?? .zero
                let visibleArea = frame.intersection(bounds)
                return frame.height > 0 && !visibleArea.isNull && visibleArea.height / min(frame.height, bounds.height) >= 0.65
            } action: { visible = $0; updatePlayback() }
            .onAppear {
                guard player == nil else { return }
                let item = AVPlayerItem(url: url); item.preferredForwardBufferDuration = 2; item.preferredPeakBitRate = 2_500_000; item.preferredMaximumResolution = CGSize(width: 1280, height: 720)
                let next = AVPlayer(playerItem: item); next.automaticallyWaitsToMinimizeStalling = false; audioMuted = !fullScreen; next.isMuted = audioMuted; player = next; pausedByUser = !autoplay
                observer = next.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.25, preferredTimescale: 600), queue: .main) { time in
                    Task { @MainActor in guard player === next else { return }; let seconds = next.currentItem?.duration.seconds ?? 0; if seconds.isFinite && seconds > 0 { duration = seconds }; if !scrubbing && time.seconds.isFinite { progress = min(max(0, time.seconds), duration) }; isPlaying = next.rate > 0 }
                }
                updatePlayback(); scheduleControlsHide()
            }
            .task(id: url) {
                guard !fullScreen else { return }
                do {
                    let asset = player?.currentItem?.asset ?? AVURLAsset(url: url)
                    if let track = try await asset.loadTracks(withMediaType: .video).first {
                        let size = try await track.load(.naturalSize)
                        let transform = try await track.load(.preferredTransform)
                        let displayed = size.applying(transform)
                        if !Task.isCancelled, abs(displayed.height) > 0, abs(displayed.width) > 0 { videoAspect = abs(displayed.width / displayed.height) }
                    }
                } catch { /* The player retains its own loading and error handling. */ }
            }
            .onChange(of: shouldPlay) { _, playing in if !playing && !fullScreen { audioMuted = true; player?.isMuted = true }; updatePlayback() }
            .onDisappear {
                hideTask?.cancel()
                if let player { if let observer { player.removeTimeObserver(observer) }; NativePlayback.shared.pause(player) }
                observer = nil; player = nil; visible = false
            }
            .onReceive(NotificationCenter.default.publisher(for: .AVPlayerItemDidPlayToEndTime)) { notification in
                guard let player, let item = notification.object as? AVPlayerItem, item === player.currentItem, shouldPlay else { return }
                player.seek(to: .zero)
                NativePlayback.shared.play(player)
            }
    }

    private func scheduleControlsHide() {
        hideTask?.cancel()
        hideTask = Task { try? await Task.sleep(for: .seconds(2.2)); if !Task.isCancelled && !pausedByUser && !scrubbing { controlsVisible = false } }
    }
    private func updatePlayback() {
        guard let player else { return }
        if shouldPlay { NativePlayback.shared.play(player) }
        else { NativePlayback.shared.pause(player) }
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
                            Avatar(name: comment.authorName, picture: comment.authorPicture, size: 34)
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
    @State private var tagEditor = false
    @State private var tagged: [TaggedMember] = []
    @State private var location = ""

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
                Button { tagEditor = true } label: { Label("Tag people · Add location", systemImage: "mappin.and.ellipse") }
                if !tagged.isEmpty { Text(tagged.map(\.name).joined(separator: ", ")).font(.caption) }
                if !location.isEmpty { Label(location, systemImage: "mappin").font(.caption) }
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
                            if await model.publish(text, location: location, tagged: tagged) { draft = ""; dismiss() }
                        }
                    } label: { if publishing { ProgressView() } else { Text("Post").bold() } }
                    .disabled(publishing || !certified || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || draft.count > 5000)
                }
            }
        }.sheet(isPresented: $tagEditor) {
            NavigationStack {
                Form { TagSelection(selected: $tagged, location: $location) }.navigationTitle("Tags & location")
                    .toolbar { Button("Done") { tagEditor = false }.disabled(location.count > 120) }
            }.interactiveDismissDisabled(location.count > 120)
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

private struct FitVideoPlayer: UIViewRepresentable {
    let player: AVPlayer?
    func makeUIView(context: Context) -> PlayerSurface { PlayerSurface() }
    func updateUIView(_ view: PlayerSurface, context: Context) { view.layerPlayer.player = player; view.layerPlayer.videoGravity = .resizeAspect }
    final class PlayerSurface: UIView {
        override class var layerClass: AnyClass { AVPlayerLayer.self }
        var layerPlayer: AVPlayerLayer { layer as! AVPlayerLayer }
    }
}

struct MemberProfileIdentity: View {
    let name: String
    let picture: String?
    let email: String?
    let isDemo: Bool
    var own = false
    @State private var profile: MemberProfile?
    @State private var error = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ZStack(alignment: .bottom) {
                Group {
                    if let value = profile?.cover, let url = URL(string: value), url.scheme == "https" {
                        AsyncImage(url: url) { image in image.resizable().scaledToFill() } placeholder: { SocialStyle.blue.opacity(0.25) }
                    } else { LinearGradient(colors: [SocialStyle.blue.opacity(0.8), .black], startPoint: .topLeading, endPoint: .bottomTrailing) }
                }.frame(height: 190).clipped().padding(.bottom, 62).accessibilityLabel("Cover image of \(profile?.name ?? name)")
                Avatar(name: profile?.name ?? name, picture: profile?.picture ?? picture, size: 124).padding(5).background(SocialStyle.card, in: Circle()).accessibilityLabel("Profile image of \(profile?.name ?? name)")
            }
            VStack(alignment: .leading, spacing: 8) {
                Text(profile?.name ?? name).font(.title.bold()).frame(maxWidth: .infinity, alignment: .center)
                if let handle = profile?.handle, !handle.isEmpty { Text("@" + handle).foregroundStyle(.secondary) }
                if let bio = profile?.bio, !bio.isEmpty { Text(bio) }
                if let location = profile?.location, !location.isEmpty { Label(location, systemImage: "mappin.and.ellipse") }
                if let work = profile?.work, !work.isEmpty { Label(work, systemImage: "briefcase") }
                if let value = profile?.website, let url = URL(string: value), url.scheme == "https" { Link(value, destination: url) }
                if !error.isEmpty { Text(error).font(.caption).foregroundStyle(.secondary) }
            }.padding(.horizontal, 18)
        }.padding(.bottom, 12).background(SocialStyle.card)
            .task {
                guard !isDemo else { return }
                guard own || email?.isEmpty == false else { error = "This member’s full profile is not available from this post yet."; return }
                do { profile = try await APIClient().memberProfile(email: email) }
                catch { self.error = "The full profile could not be loaded. Try again later." }
            }
    }
}

private struct NativeTribesView: View {
    @EnvironmentObject private var model: AppModel
    @State private var custom: [CommunityGroup] = []
    @State private var joined: Set<String> = []
    @State private var ready = false
    @State private var loading = false
    @State private var busy: Set<String> = []
    @State private var name = ""
    @State private var category = "Artists"
    @State private var standards = false
    @State private var feedback = ""
    @State private var pendingDelete: CommunityGroup?
    @State private var reporting: CommunityGroup?
    @State private var reportDetails = ""
    private let api = APIClient()
    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 16) {
                Text("Find communities by category, create a Tribe, and connect with people who share your interests.").font(.subheadline).foregroundStyle(.secondary)
                VStack(alignment: .leading, spacing: 14) {
                    Text("Create a Tribe").font(.title3.bold())
                    TextField("Name your Tribe", text: $name).textFieldStyle(.roundedBorder).accessibilityIdentifier("tribes.name")
                        .onChange(of: name) { _, value in if value.count > 80 { name = String(value.prefix(80)) } }
                    Picker("Category", selection: $category) { ForEach(CommunityGroup.categories, id: \.raw) { item in Text(item.name).tag(item.raw) } }
                    Toggle("I agree to enforce DanzStak Community Standards: no hate speech, harassment, threats, or targeted abuse.", isOn: $standards).font(.caption)
                    Button("Create Tribe") { Task { await create() } }.buttonStyle(.borderedProminent).disabled(!ready || busy.contains("create"))
                }.padding(16).background(SocialStyle.card, in: RoundedRectangle(cornerRadius: 16))
                if loading { ProgressView("Loading Tribes…") }
                if !feedback.isEmpty { Text(feedback).font(.caption).foregroundStyle(.secondary) }
                ForEach(custom + CommunityGroup.defaults) { group in
                    VStack(alignment: .leading, spacing: 12) {
                        Text(CommunityGroup.categories.first { $0.raw == group.category }?.name ?? group.category).font(.caption.bold()).foregroundStyle(SocialStyle.blue)
                        Text(group.name).font(.title3.bold())
                        Text(group.description).font(.subheadline).foregroundStyle(.secondary)
                        Text(["Politics", "Religion"].contains(group.category) ? "Moderated discussion" : "Community Standards apply").font(.subheadline.bold())
                        Text("Hate speech, harassment, threats, and targeted abuse are not allowed.").font(.caption).foregroundStyle(.secondary)
                        Button("Report a problem") { reportDetails = ""; reporting = group }.font(.caption)
                        Button(joined.contains(group.id) ? "Joined" : "Join Tribe") { Task { await membership(group) } }
                            .buttonStyle(.borderedProminent).disabled(!ready || busy.contains(group.id)).accessibilityIdentifier("tribes.join.\(group.id)")
                        if group.isOwner == true { Button("Delete Tribe", role: .destructive) { pendingDelete = group }.disabled(busy.contains(group.id)) }
                    }.padding(16).frame(maxWidth: .infinity, alignment: .leading).background(SocialStyle.card, in: RoundedRectangle(cornerRadius: 16))
                }
                Button("Refresh Tribes") { Task { await load() } }.disabled(loading || !busy.isEmpty)
            }.padding(16).frame(maxWidth: 760).frame(maxWidth: .infinity)
        }.background(SocialStyle.canvas).navigationTitle("Tribes").task { await load() }.refreshable { if busy.isEmpty { await load() } }
            .confirmationDialog("Delete this Tribe? This cannot be undone.", isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }), titleVisibility: .visible) {
                if let group = pendingDelete { Button("Delete Tribe", role: .destructive) { Task { await remove(group) } } }
            }
            .sheet(item: $reporting) { group in
                NavigationStack {
                    Form {
                        Text("What should moderators review?")
                        TextEditor(text: $reportDetails).frame(minHeight: 130).onChange(of: reportDetails) { _, value in if value.count > 500 { reportDetails = String(value.prefix(500)) } }
                        Text(feedback).font(.caption).foregroundStyle(.secondary)
                    }.navigationTitle("Report a problem").toolbar {
                        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { reporting = nil } }
                        ToolbarItem(placement: .confirmationAction) { Button("Submit") { Task { await report(group) } }.disabled(busy.contains("report") || reportDetails.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) }
                    }
                }
            }
    }
    private func load() async {
        guard !loading else { return }; loading = true; defer { loading = false }
        if model.isDemo { ready = true; feedback = "Preview · Tribe changes stay on this device"; return }
        ready = false
        do {
            async let groups = api.groups(); async let memberships = api.groupMemberships()
            let result = try await (groups, memberships)
            custom = result.0; joined = result.1; ready = true; feedback = ""
        } catch APIClient.Failure.sessionExpired { model.expireSession() }
        catch { feedback = "Tribes could not be loaded. Categories are shown below; tap Refresh Tribes to retry." }
    }
    private func create() async {
        let value = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { feedback = "Name your Tribe."; return }
        guard standards else { feedback = "Agree to the Community Standards before creating a Tribe."; return }
        busy.insert("create"); defer { busy.remove("create") }
        do {
            let group = model.isDemo ? CommunityGroup(id: UUID().uuidString, name: value, category: category, description: "A new DanzStak community group.", isOwner: true) : try await api.createGroup(name: value, category: category)
            custom.insert(group, at: 0); joined.insert(group.id); name = ""; standards = false; feedback = model.isDemo ? "Preview · Tribe stays on this device" : "Tribe created"
        } catch APIClient.Failure.sessionExpired { model.expireSession() }
        catch { feedback = "The Tribe could not be created. Your details are saved here; try again." }
    }
    private func membership(_ group: CommunityGroup) async {
        let next = !joined.contains(group.id); busy.insert(group.id); defer { busy.remove(group.id) }
        do {
            if !model.isDemo { try await api.joinGroup(group.id, joined: next) }
            if next { joined.insert(group.id) } else { joined.remove(group.id) }
            feedback = model.isDemo ? "Preview · Membership stays on this device" : "Membership saved"
        } catch APIClient.Failure.sessionExpired { model.expireSession() }
        catch { feedback = "Membership could not be saved. Try again." }
    }
    private func remove(_ group: CommunityGroup) async {
        busy.insert(group.id); defer { busy.remove(group.id) }
        do { if !model.isDemo { try await api.deleteGroup(group.id) }; custom.removeAll { $0.id == group.id }; joined.remove(group.id); pendingDelete = nil }
        catch APIClient.Failure.sessionExpired { model.expireSession() }
        catch { feedback = "The Tribe could not be deleted. Try again." }
    }
    private func report(_ group: CommunityGroup) async {
        busy.insert("report"); defer { busy.remove("report") }
        do { if !model.isDemo { try await api.reportGroup(group.id, details: reportDetails.trimmingCharacters(in: .whitespacesAndNewlines)) }; reporting = nil; feedback = model.isDemo ? "Preview · No report was sent" : "Report submitted" }
        catch APIClient.Failure.sessionExpired { model.expireSession() }
        catch { feedback = "The report could not be submitted. Your text is saved here; try again." }
    }
}
