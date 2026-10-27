import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var model: AppModel
    @State private var draft = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                if model.signedIn {
                    HStack(alignment: .bottom) {
                        TextField("What's on your mind?", text: $draft, axis: .vertical).lineLimit(2...5).textFieldStyle(.roundedBorder)
                        Button("Post") { let text = draft; draft = ""; Task { await model.publish(text) } }.buttonStyle(.borderedProminent)
                    }
                    List(model.posts) { post in
                        VStack(alignment: .leading, spacing: 7) {
                            Text(post.author).font(.headline)
                            Text(post.text)
                            Text(post.createdAt).font(.caption).foregroundStyle(.secondary)
                        }.padding(.vertical, 5)
                    }.listStyle(.plain)
                } else {
                    Spacer()
                    Button("Log in to DanzStak") { model.login() }.buttonStyle(.borderedProminent).controlSize(.large)
                    Spacer()
                }
                Text(model.status).font(.footnote).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding()
            .navigationTitle("DanzStak")
            .toolbar {
                if model.signedIn { Button("Logout") { Task { await model.logout() } } }
            }
            .task { await model.start() }
        }
    }
}
