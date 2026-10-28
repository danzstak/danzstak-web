import Foundation
import UserNotifications

@MainActor
final class MessageAlerts: NSObject, ObservableObject, UNUserNotificationCenterDelegate {
    static let shared = MessageAlerts()
    private var seen: [String: String] = [:]
    private var hasBaseline = false
    private let center = UNUserNotificationCenter.current()
    override init() { super.init(); center.delegate = self }
    func enable() async throws -> Bool { try await center.requestAuthorization(options: [.alert, .badge, .sound]) }
    func clear(_ contact: String) { center.removeDeliveredNotifications(withIdentifiers: ["message." + contact]) }
    func reset() { seen = [:]; hasBaseline = false }
    func poll() async {
        let settings = await center.notificationSettings()
        guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else { return }
        guard let chats = try? await APIClient().conversations() else { return }
        for chat in chats {
            if chat.muted == true { clear(chat.id) }
            if chat.muted != true && hasBaseline && chat.unread > 0 && seen[chat.id] != chat.updatedAt {
                let content = UNMutableNotificationContent()
                content.title = "DanzStak · \(chat.name)"; content.body = "New message"; content.sound = .default
                content.threadIdentifier = chat.id
                try? await center.add(UNNotificationRequest(identifier: "message.\(chat.id)", content: content, trigger: nil))
            }
            seen[chat.id] = chat.updatedAt
        }
        hasBaseline = true
    }
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions { [.banner, .sound] }
}
