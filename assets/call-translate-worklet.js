"use strict";
// Task 21: turns the caller's own microphone into 16 kHz 16-bit PCM for Amazon Transcribe streaming, in 100 ms chunks.
// The worklet runs at the phone's own rate (often 48 kHz); each output sample is the average of the input samples it
// covers, which is enough for speech.
class DanzStakPcm16 extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000; // eslint-disable-line no-undef
    this.step = 0; this.sum = 0; this.count = 0;
    this.buffer = new Int16Array(1600); this.filled = 0;
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i += 1) {
      this.sum += channel[i]; this.count += 1; this.step += 1;
      if (this.step < this.ratio) continue;
      this.step -= this.ratio;
      const value = Math.max(-1, Math.min(1, this.sum / this.count));
      this.sum = 0; this.count = 0;
      this.buffer[this.filled++] = value < 0 ? value * 0x8000 : value * 0x7fff;
      if (this.filled === this.buffer.length) {
        this.port.postMessage(this.buffer.buffer, [this.buffer.buffer]);
        this.buffer = new Int16Array(1600); this.filled = 0;
      }
    }
    return true;
  }
}
registerProcessor("danzstak-pcm16", DanzStakPcm16);
