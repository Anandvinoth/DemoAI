// src/app/services/voice-service.ts
import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { TtsService } from './tts.service';

export interface ListenOptions {
  language?: string;
  continuous?: boolean;
}

@Injectable({ providedIn: 'root' })
export class VoiceService {
  private recognition: SpeechRecognition | null = null;

  readonly isListening$ = new BehaviorSubject<boolean>(false);
  private textSubject = new Subject<string>();
  readonly text$ = this.textSubject.asObservable();

  // mute NLP calls (e.g., while chooser is visible)
  mutedToApi$ = new BehaviorSubject<boolean>(false);

  // track chooser on/off
  readonly chooserActive$ = new BehaviorSubject<boolean>(false);

  constructor(private zone: NgZone, private tts: TtsService) {}

  /**
   * Start listening once. Returns an Observable that emits recognized text.
   * A new SpeechRecognition instance is created each call (your original pattern).
   */
  startListening(opts: ListenOptions = {}): Observable<string> {
    const Ctor =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!Ctor) {
      return new Observable(o => o.error(new Error('Web Speech API not supported.')));
    }

    const rec: SpeechRecognition = new Ctor();
    rec.lang = opts.language ?? 'en-US';
    rec.continuous = !!opts.continuous;
    (rec as any).interimResults = false;

    return new Observable<string>(observer => {
      const onResult = (ev: SpeechRecognitionEvent) => {
        let finalChunk = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i];
          if (res.isFinal) finalChunk += res[0].transcript;
        }
        const spoken = finalChunk.trim();
        if (spoken) {
          // hard-stop TTS the moment the user speaks
          if (this.tts.isSpeaking() || this.tts.isPending()) {
            this.tts.interrupt();
            console.log('🛑 Interrupted TTS — user started speaking');
          }

          this.zone.run(() => {
            observer.next(spoken);
            this.textSubject.next(spoken);
          });

          if (!rec.continuous) {
            try { rec.stop(); } catch {}
          }
        }
      };

      const onError = (e: any) => {
          if (e?.error === 'aborted') {
            console.log('ℹ️ SpeechRecognition aborted intentionally (during TTS)');
            return; // don’t treat it as an error
          }
          this.zone.run(() => observer.error(new Error(e?.error || 'speech-error')));
      };


      const onEnd = () => {
        this.zone.run(() => {
          this.isListening$.next(false);
          observer.complete();
        });
      };

      (rec as any).addEventListener('result', onResult as any);
      (rec as any).addEventListener('error', onError as any);
      (rec as any).addEventListener('end', onEnd as any);

      this.isListening$.next(true);
      try {
        rec.start();
        console.log('🎙️ Mic started');
      } catch (err) {
        console.error('🎙️ Failed to start SpeechRecognition:', err);
        this.isListening$.next(false);
        observer.error(err);
      }

      this.recognition = rec;

      return () => {
        try {
          (rec as any).removeEventListener('result', onResult as any);
          (rec as any).removeEventListener('error', onError as any);
          (rec as any).removeEventListener('end', onEnd as any);
          rec.stop();
        } catch {}
        this.isListening$.next(false);
        this.recognition = null;
        console.log('🛑 Mic stopped (cleanup)');
      };
    });
  }

  stop(): void {
    try { this.recognition?.stop(); } catch {}
    this.isListening$.next(false);
    console.log('🛑 Mic stopped manually');
  }

  muteToApi()  { this.mutedToApi$.next(true);  }
  unmuteToApi(){ this.mutedToApi$.next(false); }

  setChooserActive(active: boolean) {
    this.chooserActive$.next(active);
  }
  
  stopListeningDuringTTS() {
      if (this.recognition) {
        try {
          this.recognition.abort();
          console.log('🛑 Mic truly stopped during TTS');
        } catch (err) {
          console.warn('⚠️ Could not stop mic:', err);
        }
      }
      this.isListening$.next(false);
    }

    resumeListeningAfterTTS(delayMs = 400) {
      setTimeout(() => {
        // only restart if we are currently not listening
        if (!this.isListening$.value) {
          console.log('🎤 Mic resumed after TTS');
          this.startListening(); // restart recognition
        }
      }, delayMs);
    }
}
