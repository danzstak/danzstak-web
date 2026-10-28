import SwiftUI

@main
struct DanzStakApp: App {
    @StateObject private var model = AppModel()
    @Environment(\.scenePhase) private var phase

    var body: some Scene {
        WindowGroup {
            ContentView().environmentObject(model)
                .task(id: model.signedIn) {
                    MessageAlerts.shared.reset()
                    guard model.signedIn, !model.isDemo else { return }
                    while !Task.isCancelled {
                        if phase == .active { await MessageAlerts.shared.poll() }
                        try? await Task.sleep(for: .seconds(15))
                    }
                }
        }
    }
}
