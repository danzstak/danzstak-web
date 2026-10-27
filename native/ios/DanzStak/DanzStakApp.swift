import SwiftUI

@main
struct DanzStakApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            ContentView().environmentObject(model)
        }
    }
}
