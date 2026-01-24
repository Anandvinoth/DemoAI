//tts.service.ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TtsService {
  private synth = window.speechSynthesis;

  /** Speak immediately (cancels anything pending) */
 speak(text: string, opts: any = {}) {
      const utter = new SpeechSynthesisUtterance(text); // ✅ THIS WAS MISSING

      utter.lang = opts.lang ?? 'en-US';
      utter.rate = opts.rate ?? 1;
      utter.pitch = opts.pitch ?? 1;

      document.dispatchEvent(
        new CustomEvent('tts-started', { detail: { text } })
      );

      utter.onend = () => {
        document.dispatchEvent(
          new CustomEvent('tts-ended', { detail: { text } })
        );
      };

      utter.onerror = () => {
        document.dispatchEvent(
          new CustomEvent('tts-ended', { detail: { text } })
        );
      };

      speechSynthesis.speak(utter);
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
