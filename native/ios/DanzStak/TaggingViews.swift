import SwiftUI

struct TagSelection: View {
    @EnvironmentObject private var model: AppModel
    @Binding var selected: [TaggedMember]
    @Binding var location: String
    @State private var friends: [TagFriend] = []
    @State private var error = ""
    @State private var query = ""
    var body: some View {
        Section("Location") {
            TextField("Add a place or city", text: $location).accessibilityIdentifier("tags.location")
            Text("\(location.count) / 120 · Only share a location you want others to see.").font(.caption).foregroundStyle(location.count > 120 ? .red : .secondary)
        }
        Section("Tag people") {
            ForEach(selected) { person in
                HStack { Text(person.name); Spacer(); Button("Remove", systemImage: "xmark.circle") { selected.removeAll { $0.id == person.id } }.labelStyle(.iconOnly) }
            }
            TextField("Find a friend", text: $query)
            ForEach(friends.filter { friend in !selected.contains { $0.id == friend.id } && (query.isEmpty || friend.name.localizedCaseInsensitiveContains(query)) }) { friend in
                Button { selected.append(TaggedMember(memberId: friend.id, name: friend.name)) } label: { Label(friend.name, systemImage: "person.badge.plus") }.disabled(selected.count >= 10)
            }
            if !error.isEmpty { Text(error).foregroundStyle(.red); Button("Retry") { Task { await load() } } }
            Text("Choose up to 10 friends. Their tagging privacy settings apply. Removed tags cannot be restored here.").font(.caption).foregroundStyle(.secondary)
        }.task { await load() }
    }
    private func load() async {
        error = ""
        if model.isDemo { friends = [TagFriend(memberId: "demo-friend", name: "Jamie Rivera", friendStatus: "friends")]; return }
        do { friends = try await APIClient().friendsForTags() }
        catch { self.error = "Friends could not be loaded." }
    }
}

struct PostTagEditor: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let post: FeedPost
    @State private var selected: [TaggedMember]
    @State private var location: String
    @State private var saving = false
    @State private var error = ""
    init(post: FeedPost) { self.post = post; _selected = State(initialValue: post.taggedUsers ?? []); _location = State(initialValue: post.location ?? "") }
    var body: some View {
        NavigationStack {
            Form { TagSelection(selected: $selected, location: $location); if !error.isEmpty { Text(error).foregroundStyle(.red) } }
                .disabled(saving).navigationTitle("Tags & location").navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(saving) }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") {
                            saving = true
                            Task {
                                defer { saving = false }
                                do { try await model.updateTags(post, members: selected, location: location.trimmingCharacters(in: .whitespacesAndNewlines)); dismiss() }
                                catch { self.error = "Tags could not be saved. A friend may have disabled tagging or removed their tag. Reload and try again." }
                            }
                        }.disabled(saving || location.count > 120)
                    }
                }
        }.interactiveDismissDisabled(saving)
    }
}

struct TaggingPrivacyView: View {
    @EnvironmentObject private var model: AppModel
    @State private var settings: TaggingSettings?
    @State private var saving = false
    @State private var error = ""
    var body: some View {
        Form {
            Section("Tagging") {
                if let settings {
                    Toggle("Allow people to tag me", isOn: Binding(get: { self.settings?.allowTags ?? settings.allowTags }, set: { value in Task { await save(value) } })).disabled(saving).accessibilityIdentifier("profile.allowTags")
                    Text("Friends can tag you in posts, photos and videos. Turning this off blocks new tags. To remove an existing tag, long-press the photo or video and choose Remove my tag, or use Post options.").font(.footnote).foregroundStyle(.secondary)
                } else if error.isEmpty { ProgressView() }
                if !error.isEmpty { Text(error).foregroundStyle(.red); Button("Retry") { Task { await load() } } }
                if model.isDemo { Text("Preview only: this setting is not saved to your account.").font(.caption) }
            }
        }.navigationTitle("Edit Profile").task { await load() }
    }
    private func load() async {
        error = ""
        if model.isDemo { settings = TaggingSettings(allowTags: true); return }
        do { settings = try await APIClient().taggingSettings() }
        catch { self.error = "Tagging settings could not be loaded." }
    }
    private func save(_ value: Bool) async {
        guard var updated = settings else { return }
        updated.allowTags = value; saving = true; error = ""
        defer { saving = false }
        do { if !model.isDemo { try await APIClient().saveTaggingSettings(updated) }; settings = updated }
        catch { self.error = "Your tagging setting could not be saved. Try again." }
    }
}
