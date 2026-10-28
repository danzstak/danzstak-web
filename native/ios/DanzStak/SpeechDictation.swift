import AVFoundation
import Combine
import Speech

@MainActor
final class SpeechDictation: ObservableObject {
    @Published var listening = false
    @Published var error = ""
    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var generation = UUID()
    private var installedTap = false
    private var limitTask: Task<Void, Never>?

    func start(update: @escaping (String) -> Void) async {
        stop(); error = ""
        let id = UUID(); generation = id
        let authorization = await withCheckedContinuation { continuation in SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0) } }
        guard generation == id else { return }
        guard authorization == .authorized else { error = "Allow Speech Recognition in iOS Settings to dictate messages."; return }
        let allowed = await withCheckedContinuation { continuation in AVAudioSession.sharedInstance().requestRecordPermission { continuation.resume(returning: $0) } }
        guard generation == id else { return }
        guard allowed else { error = "Allow microphone access in iOS Settings to dictate messages."; return }
        guard let recognizer = SFSpeechRecognizer(locale: .current), recognizer.isAvailable else { error = "Speech recognition is unavailable right now. You can keep typing."; return }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true)
            let input = engine.inputNode; let format = input.outputFormat(forBus: 0)
            guard format.sampleRate > 0, format.channelCount > 0 else { throw URLError(.cannotOpenFile) }
            let request = SFSpeechAudioBufferRecognitionRequest(); request.shouldReportPartialResults = true
            self.request = request
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in request.append(buffer) }; installedTap = true
            task = recognizer.recognitionTask(with: request) { [weak self] result, failure in
                Task { @MainActor in
                    guard let self, self.generation == id else { return }
                    if let result { update(result.bestTranscription.formattedString) }
                    if result?.isFinal == true || failure != nil { self.stop(); if failure != nil && result == nil { self.error = "Speech could not be recognized. Your draft is saved." } }
                }
            }
            engine.prepare(); try engine.start(); listening = true
            limitTask = Task { [weak self] in try? await Task.sleep(for: .seconds(60)); if !Task.isCancelled { self?.stop() } }
        } catch { stop(); self.error = "The microphone could not start. You can keep typing." }
    }
    func stop() {
        generation = UUID(); limitTask?.cancel(); limitTask = nil
        engine.stop(); if installedTap { engine.inputNode.removeTap(onBus: 0); installedTap = false }
        request?.endAudio(); task?.cancel(); request = nil; task = nil; listening = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
