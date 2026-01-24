// src/app/services/voice/voice-session.service.ts
import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { VoiceService, ListenOptions } from '../voice-service';
import { TtsService } from '../tts.service';
import { VoiceTelemetryService } from './voice-telemetry.service';

export interface VoiceContext {
  id: string;
  onActivate?: () => void;
  onDeactivate?: () => void;
  onFinal: (text: string) => void;
  onPartial?: (text: string) => void;
  wantsListening?: boolean;
  onMicRequest?: () => void;
}

@Injectable({ providedIn: 'root' })
export class VoiceSessionService implements OnDestroy {
  private contexts = new Map<string, VoiceContext>();

  private activeContextId?: string;

  private isStarted = false;
  private streamToken = 0;

  private lastFinalAt = 0;
  private lastFinalText = '';

  private sttSub?: Subscription;

  private owningMic = false;

  private lastListenOpts: ListenOptions = { language: 'en-US', continuous: false };

  private pendingResumeAfterTts = false;

  private onTtsStartedBound = (e: Event) => this.onTtsStarted(e);
  private onTtsEndedBound = (e: Event) => this.onTtsEnded(e);

  private lastTtsText = '';
  private lastTtsEndedAt = 0;
  private ttsActive = false;

  constructor(
    private zone: NgZone,
    private voice: VoiceService,
    private tts: TtsService,
    private telemetry: VoiceTelemetryService
  ) {
    document.addEventListener('tts-started', this.onTtsStartedBound);
    document.addEventListener('tts-ended', this.onTtsEndedBound);

    this.telemetry.emit('TTS_START', {
      message: 'VoiceSession bound to TTS events'
    });
  }

  // ------------------------------------------------------------
  // helpers
  // ------------------------------------------------------------

  private norm(s: string): string {
    return (s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
  }

  private isTtsEcho(spoken: string): boolean {
    const t = this.norm(spoken);
    const last = this.norm(this.lastTtsText);
    if (!t || !last) return false;

    if (t === last) return true;
    if (last.includes(t) && t.length >= 8) return true;

    return false;
  }

  // ------------------------------------------------------------
  // Context Management
  // ------------------------------------------------------------

  register(ctx: VoiceContext): void {
    if (this.contexts.has(ctx.id)) return;

    this.contexts.set(ctx.id, ctx);

    this.telemetry.emit('CTX_REGISTER', {
      ctx: ctx.id,
      message: 'Voice context registered'
    });
  }

  unregister(id: string): void {
    if (this.activeContextId === id) {
      this.setActive(undefined);
    }

    this.contexts.delete(id);

    this.telemetry.emit('CTX_UNREGISTER', {
      ctx: id,
      message: 'Voice context unregistered'
    });
  }

  setActive(id?: string): void {
    // deactivate previous
    if (this.activeContextId) {
      const prev = this.contexts.get(this.activeContextId);
      prev?.onDeactivate?.();
    }

    this.activeContextId = id;

    if (!id) {
      this.telemetry.emit('CTX_CLEAR', {
        ctx: '-',
        message: 'Voice context cleared'
      });

      if (this.owningMic) this.stop();
      return;
    }

    const ctx = this.contexts.get(id);
    if (!ctx) {
      this.telemetry.emit('ERROR', {
        ctx: id,
        message: 'Attempted to activate unregistered context'
      });
      return;
    }

    this.telemetry.emit('CTX_SET_ACTIVE', {
      ctx: id,
      message: 'Voice context activated'
    });

    // let context do its own startup
    ctx.onActivate?.();

    // If session already owns mic AND context wants continuous mic, start/restart safely
    if (this.owningMic && ctx.wantsListening) {
      // IMPORTANT: requestListening tears down stale streams; start() will recover if dead
      this.start({ language: 'en-US', continuous: true });
    }
  }

  getActiveContextId(): string | undefined {
    return this.activeContextId;
  }

  // ------------------------------------------------------------
  // Mic Control
  // ------------------------------------------------------------

  start(opts: ListenOptions = { language: 'en-US', continuous: false }): void {
    // If we think we started, but stream+mic are dead => recover
    if (this.isStarted) {
      const streamAlive = !!this.sttSub && !this.sttSub.closed;
      const micAlive = this.voice.isListening$.value;

      if (!streamAlive && !micAlive) {
        this.telemetry.emit('STT_RECOVER', {
          ctx: this.activeContextId ?? '-',
          message: 'Recovering from stale isStarted lock (stream ended)'
        });

        this.isStarted = false;
        this.stopSttStream();
      } else {
        this.lastListenOpts = { ...opts };
        return;
      }
    }

    this.isStarted = true;
    this.owningMic = true;
    this.lastListenOpts = { ...opts };

    this.startSttStream();
  }

  stop(): void {
    this.isStarted = false;
    this.stopSttStream();

    this.voice.stop();

    this.telemetry.emit('STT_STOP', {
      ctx: this.activeContextId ?? '-',
      message: 'STT stopped by session'
    });
  }

  requestListening(opts: ListenOptions = { language: 'en-US', continuous: false }): void {
    if (!this.activeContextId) return;

    this.telemetry.emit('STT_START', {
      ctx: this.activeContextId,
      message: 'Re-arming STT for guided flow'
    });

    if (this.isStarted) {
      this.stop();
    }

    this.start(opts);
  }

  // ------------------------------------------------------------
  // Internal STT Stream Routing
  // ------------------------------------------------------------

  private startSttStream(): void {
    console.log('startSttStream method in voice-session.service.ts#################');

    const token = ++this.streamToken;
    this.stopSttStream();

    let gotFinal = false;

    // Snapshot ONLY for complete()/retry checks (not for routing finals!)
    const streamStartedForCtx = this.activeContextId;

    this.telemetry.emit('STT_START', { ctx: this.activeContextId ?? '-' });

    this.sttSub = this.voice.startListening(this.lastListenOpts).subscribe({
      next: (text: string) => {
        gotFinal = true;

        // token safety (if a newer stream started, ignore this one)
        if (token !== this.streamToken) return;

        // de-dupe finals
        const now = Date.now();
        const n = this.norm(text);
        if (n && n === this.lastFinalText && now - this.lastFinalAt < 800) {
          return;
        }
        this.lastFinalText = n;
        this.lastFinalAt = now;

        // echo suppression
        if (now - this.lastTtsEndedAt < 2500 && this.isTtsEcho(text)) {
          this.telemetry.emit('STT_DROP_ECHO', {
            ctx: this.activeContextId ?? '-',
            payload: { text }
          });
          return;
        }

        this.zone.run(() => {
          const activeIdNow = this.activeContextId;

          // 🔑 FIRST: always feed legacy pipeline for orders
          if (activeIdNow === 'orders') {
            this.voice.emitRecognizedText(text);
          }

          this.telemetry.emit('STT_FINAL', {
            ctx: activeIdNow ?? '-',
            payload: { text }
          });

          const ctx = activeIdNow ? this.contexts.get(activeIdNow) : null;
          ctx?.onFinal(text);
        });

      },

      error: (err) => {
        if (token !== this.streamToken) return;

        this.telemetry.emit('ERROR', {
          ctx: this.activeContextId ?? '-',
          message: 'STT stream error',
          payload: { err: String(err) }
        });
      },

      complete: () => {
        if (token !== this.streamToken) return;

        // If TTS paused mic, do not fight it
        if (this.pendingResumeAfterTts || this.ttsActive) {
          this.isStarted = false;
          return;
        }

        // stream ended => not started anymore
        this.isStarted = false;

        // silence retry (only if still on same ctx that started the stream)
        if (!gotFinal && this.owningMic && this.activeContextId === streamStartedForCtx) {
          this.telemetry.emit('STT_RETRY', {
            ctx: streamStartedForCtx,
            message: 'No speech detected, retrying guided step'
          });
          this.startSttStream();
          return;
        }

        // continuous restart (ONLY if current ctx wants listening)
        const ctxId = this.activeContextId;
        const ctx = ctxId ? this.contexts.get(ctxId) : null;

        if (this.owningMic && ctxId && ctx?.wantsListening) {
          this.telemetry.emit('STT_RESTART', {
            ctx: ctxId,
            message: 'STT ended unexpectedly; restarting for continuous context'
          });

          // restart with last options, forcing continuous
          this.start({ ...this.lastListenOpts, continuous: true });
        }
      }
    });
  }

  private stopSttStream(): void {
    try {
      this.sttSub?.unsubscribe();
    } catch {}
    this.sttSub = undefined;
  }

  // ------------------------------------------------------------
  // TTS Coordination
  // ------------------------------------------------------------

  private onTtsStarted(e: Event): void {
    this.ttsActive = true;

    const ev = e as any;
    const text = ev?.detail?.text;
    if (typeof text === 'string') {
      this.lastTtsText = text;
    }

    this.telemetry.emit('TTS_START', {
      ctx: this.activeContextId ?? '-',
      message: 'TTS started (event)'
    });

    if (!this.owningMic) return;

    if (this.voice.isListening$.value) {
      this.pendingResumeAfterTts = true;

      this.voice.stopListeningDuringTTS();
      this.stopSttStream();

      // unlock so we can restart after TTS
      this.isStarted = false;
    }
  }

  private onTtsEnded(e: Event): void {
    this.ttsActive = false;
    this.lastTtsEndedAt = Date.now();

    const ev = e as any;
    const text = ev?.detail?.text;
    if (typeof text === 'string') {
      this.lastTtsText = text;
    }

    this.telemetry.emit('TTS_END', {
      ctx: this.activeContextId ?? '-',
      message: 'TTS ended (event)'
    });

    if (!this.owningMic) return;

    const ctxId = this.activeContextId;
    const ctx = ctxId ? this.contexts.get(ctxId) : null;

    // resume ONLY if we paused because of TTS AND current context wants continuous mic
    if (this.pendingResumeAfterTts && ctx?.wantsListening) {
      this.pendingResumeAfterTts = false;
      this.start({ ...this.lastListenOpts, continuous: true });
      return;
    }

    this.pendingResumeAfterTts = false;
  }

  // ------------------------------------------------------------
  // Cleanup
  // ------------------------------------------------------------

  ngOnDestroy(): void {
    document.removeEventListener('tts-started', this.onTtsStartedBound);
    document.removeEventListener('tts-ended', this.onTtsEndedBound);
    this.stop();
  }
}