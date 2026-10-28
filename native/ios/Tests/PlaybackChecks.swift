import AVFoundation

@main
struct PlaybackChecks {
    @MainActor static func main() {
        let coordinator = NativePlayback()
        let first = AVPlayer()
        let second = AVPlayer()
        coordinator.play(first)
        precondition(coordinator.currentPlayer === first)
        coordinator.play(second)
        precondition(first.rate == 0)
        precondition(coordinator.currentPlayer === second)
        coordinator.pause(first)
        precondition(coordinator.currentPlayer === second, "An old page must not stop the new page")
        coordinator.pause(second)
        precondition(coordinator.currentPlayer == nil)
        precondition(second.rate == 0)
        coordinator.play(first)
        coordinator.stop()
        precondition(first.rate == 0 && coordinator.currentPlayer == nil)
        print("Playback checks passed: exclusive playback, stale-page pause safety, and stop/cleanup.")
    }
}
