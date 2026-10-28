import AVFoundation

/// One audible native video at a time. Views release playback as soon as they lose visibility.
@MainActor
final class NativePlayback {
    static let shared = NativePlayback()
    private(set) var currentPlayer: AVPlayer?

    func play(_ player: AVPlayer) {
        if currentPlayer !== player {
            currentPlayer?.pause()
            currentPlayer = player
            #if os(iOS)
            try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
            try? AVAudioSession.sharedInstance().setActive(true)
            #endif
        }
        player.play()
    }

    func pause(_ player: AVPlayer) {
        player.pause()
        if currentPlayer === player { stop() }
    }

    func stop() {
        currentPlayer?.pause()
        currentPlayer = nil
        #if os(iOS)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        #endif
    }
}
