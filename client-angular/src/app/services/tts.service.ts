// tts.service.ts
import { Injectable } from '@angular/core';

type SpeakOpts = {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceNameIncludes?: string; // optional: pick by name fragment
};

@Injectable({ providedIn: 'root' })
export class TtsService {
  private synth = window.speechSynthesis;
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    // Some browsers load voices async
    const load = () => {
      this.voices = this.synth.getVoices() || [];
      if (this.voices.length) {
        console.log('🎙️ Voices loaded:', this.voices.length);
      }
    };

    load();
    // Safari/Chrome often require this
    this.synth.onvoiceschanged = () => load();
  }

  // ------------------------------------------------------------
  // Core: speak and WAIT until it finishes
  // ------------------------------------------------------------
  speak(text: string, opts: SpeakOpts = {}): Promise<void> {
    if (!this.isSupported()) return Promise.resolve();

    // cancel pending to avoid overlaps
    try { this.synth.cancel(); } catch {}

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = opts.lang ?? 'en-US';
    utter.rate = opts.rate ?? 1;
    utter.pitch = opts.pitch ?? 1;
    utter.volume = opts.volume ?? 1;

    // pick voice if requested
    const v = this.pickVoice(opts.voiceNameIncludes, utter.lang);
    if (v) utter.voice = v;

    document.dispatchEvent(new CustomEvent('tts-started', { detail: { text } }));

    return new Promise<void>((resolve) => {
      const done = () => {
        document.dispatchEvent(new CustomEvent('tts-ended', { detail: { text } }));
        resolve();
      };

      utter.onend = done;
      utter.onerror = done;

      this.synth.speak(utter);
    });
  }

  // ------------------------------------------------------------
  // Speak with a specific voice fragment, and WAIT
  // ------------------------------------------------------------
  speakWithVoice(
    text: string,
    voiceNameIncludes: string,
    opts: { rate?: number; pitch?: number; lang?: string; volume?: number } = {}
  ): Promise<void> {
    return this.speak(text, {
      lang: opts.lang ?? 'en-US',
      rate: opts.rate,
      pitch: opts.pitch,
      volume: opts.volume,
      voiceNameIncludes
    });
  }

  // ------------------------------------------------------------
  // Wait until engine is idle, then speak, and WAIT until finished
  // ------------------------------------------------------------
  async speakWhenIdle(
    text: string,
    opts: { rate?: number; pitch?: number; lang?: string; volume?: number } = {},
    delayMs = 0
  ): Promise<void> {
    if (delayMs > 0) await this.sleep(delayMs);

    // wait until nothing is speaking/pending
    while (this.isSpeaking() || this.isPending()) {
      await this.sleep(120);
    }

    // now speak and WAIT until speech ends
    await this.speak(text, {
      lang: opts.lang ?? 'en-US',
      rate: opts.rate,
      pitch: opts.pitch,
      volume: opts.volume
    });
  }

  // ------------------------------------------------------------
  // Helpers + compatibility (keep your old API stable)
  // ------------------------------------------------------------
  stopSpeaking() { this.stop(); }

  interrupt() {
    try { this.synth.cancel(); } catch {}
  }

  stop() {
    if (this.isSpeaking() || this.isPending()) {
      try { this.synth.cancel(); } catch {}
      console.log('⏹️ TTS stopped');
    }
  }

  isSpeaking(): boolean { return !!this.synth?.speaking; }
  isPending(): boolean { return !!this.synth?.pending; }

  isSupported(): boolean {
    return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  unlock(): void {
    if (!this.isSupported()) return;

    // Silent utter to unlock audio on first user gesture
    const utter = new SpeechSynthesisUtterance('');
    utter.volume = 0;
    this.synth.speak(utter);

    console.log('🔓 TTS unlocked');
  }

  // ------------------------------------------------------------
  // Voice selection
  // ------------------------------------------------------------
  private pickVoice(nameIncludes?: string, lang?: string): SpeechSynthesisVoice | null {
    const voices = this.voices.length ? this.voices : (this.synth.getVoices() || []);

    if (!voices.length) return null;

    const needle = (nameIncludes || '').trim().toLowerCase();
    const targetLang = (lang || '').trim().toLowerCase();

    let found: SpeechSynthesisVoice | undefined;

    if (needle) {
      found = voices.find(v => v.name.toLowerCase().includes(needle));
      if (!found && targetLang) {
        found = voices.find(v => v.lang.toLowerCase() === targetLang && v.name.toLowerCase().includes(needle));
      }
    }

    // fallback by lang, else default, else first
    if (!found && targetLang) {
      found = voices.find(v => v.lang.toLowerCase() === targetLang);
    }
    if (!found) {
      found = voices.find(v => v.default) || voices[0];
    }

    return found ?? null;
  }

  private sleep(ms: number) {
    return new Promise(res => setTimeout(res, ms));
  }
}

