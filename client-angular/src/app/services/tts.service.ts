//tts.service.ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TtsService {
  private synth = window.speechSynthesis;

  /** Speak immediately (cancels anything pending) */
  speak(text: string, opts: { rate?: number; pitch?: number; lang?: string } = {}) {
    if (!text) return;

    // stop current speech first
    this.stop();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = opts.lang ?? 'en-US';
    utter.rate = opts.rate ?? 1;
    utter.pitch = opts.pitch ?? 1;

    // best-effort pick an English voice
    const voices = this.synth.getVoices();
    const voice = voices.find(v => v.name.includes('Google US English')) ?? voices.find(v => v.lang.startsWith('en'));
    if (voice) utter.voice = voice;

    utter.onstart = () => {
      document.dispatchEvent(new CustomEvent('tts-started'));
      console.log('🔊 TTS started');
    };
    utter.onend = () => {
      document.dispatchEvent(new CustomEvent('tts-ended'));
      console.log('✅ TTS finished');
    };
    utter.onerror = e => {
      console.error('❌ TTS error:', e.error);
      document.dispatchEvent(new CustomEvent('tts-ended'));
    };

    // small delay lets Chrome load voices
    setTimeout(() => this.synth.speak(utter), 150);
  }

  /** Wait until not speaking, then speak (used by your code) */
  async speakWhenIdle(
    text: string,
    opts: { rate?: number; pitch?: number; lang?: string } = {},
    delayMs = 0
  ): Promise<void> {
    // optional delay (e.g., to avoid colliding with UI updates)
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));

    // poll until engine is idle
    while (this.isSpeaking() || this.isPending()) {
      await new Promise(r => setTimeout(r, 120));
    }
    this.speak(text, opts);
  }

  /** Alias to match older calls in your code */
  stopSpeaking() {
    this.stop();
  }

  /** Immediately cancel any ongoing / queued speech */
  interrupt() {
    try { this.synth.cancel(); } catch {}
  }

  /** Cancel anything queued or speaking */
  stop() {
    if (this.isSpeaking() || this.isPending()) {
      this.synth.cancel();
      console.log('⏹️ TTS stopped');
    }
  }

  isSpeaking(): boolean {
    return !!this.synth?.speaking;
  }

  isPending(): boolean {
    return !!this.synth?.pending;
  }

  isSupported(): boolean {
    return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }
}
