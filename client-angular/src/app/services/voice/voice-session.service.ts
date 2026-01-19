// src/app/services/voice/voice-session.service.ts
import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { VoiceService, ListenOptions } from '../voice-service';
import { TtsService } from '../tts.service';
import { VoiceTelemetryService } from './voice-telemetry.service';

/**
 * VoiceContext:
 * A page/workflow handler (Products / Orders / OpportunityCreate)
 * that receives speech ONLY when it is the active context.
 */
export interface VoiceContext {
  /** Unique context id, e.g. 'products', 'orders', 'opportunity-create' */
  id: string;

  /** Called when this context becomes active */
  onActivate?: () => void;

  /** Called when this context loses ownership */
  onDeactivate?: () => void;

  /** Final STT result (primary path) */
  onFinal: (text: string) => void;

  /** Optional: partial results (not used with your current VoiceService) */
  onPartial?: (text: string) => void;

  /**
   * Whether this context wants the mic running while active.
   * For guided flows, we usually keep it FALSE and explicitly request turns.
   */
  wantsListening?: boolean;
  onMicRequest?: () => void;
}

/**
 * VoiceSessionService:
 * - Single owner of STT stream per browser tab (app instance)
 * - Enforces "only active context gets speech"
 * - Coordinates with TTS events to pause/resume cleanly
 *
 * IMPORTANT DESIGN:
 * - We run STT as "single-turn" unless continuous=true.
 * - For guided flows, you re-arm with requestListening().
 * - After each FINAL we tear down the STT subscription so next step can re-arm.
 */
@Injectable({ providedIn: 'root' })
export class VoiceSessionService implements OnDestroy {
  private contexts = new Map<string, VoiceContext>();

  /** Active context id (undefined means none) */
  private activeContextId?: string;

  /** True only while a STT subscription is active */
  private isStarted = false;

  /** Token increases each time we create a new STT stream; stale streams are ignored */
  private streamToken = 0;

  /** De-dupe finals (Chrome sometimes duplicates finals) */
  private lastFinalAt = 0;
  private lastFinalText = '';

  /** STT subscription owned ONLY by this service */
  private sttSub?: Subscription;

  /**
   * Whether this service is allowed to control mic (start/stop) right now.
   * If you want “session owns everything”, keep this true.
   */
  private owningMic = false;

  /** Remember last listening options; used when resuming after TTS */
  private lastListenOpts: ListenOptions = { language: 'en-US', continuous: false };

  /** True when TTS paused the mic; we resume after TTS_END */
  private pendingResumeAfterTts = false;

  /** DOM event handlers for cleanup */
  private onTtsStartedBound = () => this.onTtsStarted();
  private onTtsEndedBound = () => this.onTtsEnded();

  constructor(
    private zone: NgZone,
    private voice: VoiceService,
    private tts: TtsService,
    private telemetry: VoiceTelemetryService
  ) {
    // Bind to your TtsService lifecycle events
    document.addEventListener('tts-started', this.onTtsStartedBound);
    document.addEventListener('tts-ended', this.onTtsEndedBound);

    this.telemetry.emit('TTS_START', {
      message: 'VoiceSession bound to TTS events'
    });
  }

  // ------------------------------------------------------------
  // Context Management
  // ------------------------------------------------------------

  /**
   * Register a context.
   * Call from component ngOnInit() (safe to call multiple times).
   */
  register(ctx: VoiceContext): void {
    if (this.contexts.has(ctx.id)) return;

    this.contexts.set(ctx.id, ctx);

    this.telemetry.emit('CTX_REGISTER', {
      ctx: ctx.id,
      message: 'Voice context registered'
    });
  }

  /**
   * Unregister a context.
   * Call from component ngOnDestroy().
   */
  unregister(id: string): void {
    if (this.activeContextId === id) {
      // If active context is being removed, deactivate and clear
      this.setActive(undefined);
    }

    this.contexts.delete(id);

    this.telemetry.emit('CTX_UNREGISTER', {
      ctx: id,
      message: 'Voice context unregistered'
    });
  }

  /**
   * Set which context is allowed to receive speech.
   * Only the active context gets onFinal().
   */
  setActive(id?: string): void {
    // Deactivate previous context
    if (this.activeContextId) {
      const prev = this.contexts.get(this.activeContextId);
      prev?.onDeactivate?.();
    }

    // Assign new active id
    this.activeContextId = id;

    // If clearing, stop session listening (if we own mic)
    if (!id) {
      this.telemetry.emit('CTX_CLEAR', {
        ctx: '-',
        message: 'Voice context cleared'
      });

      // Important: if session was listening, stop it so we don’t leak subscriptions
      if (this.owningMic) this.stop();
      return;
    }

    // Validate context exists
    const ctx = this.contexts.get(id);
    if (!ctx) {
      this.telemetry.emit('ERROR', {
        ctx: id,
        message: 'Attempted to activate unregistered context'
      });
      return;
    }

    // Log activation
    this.telemetry.emit('CTX_SET_ACTIVE', {
      ctx: id,
      message: 'Voice context activated'
    });

    // Let context do its own startup (TTS prompt, etc.)
    ctx.onActivate?.();

    // If context wants always-listening and session owns mic, start it
    if (this.owningMic && ctx.wantsListening) {
      this.start({ language: 'en-US', continuous: true });
    }
  }

  /**
   * Helper for guards (Header only, etc.)
   */
  getActiveContextId(): string | undefined {
    return this.activeContextId;
  }

  // ------------------------------------------------------------
  // Mic Control (Session Level)
  // ------------------------------------------------------------

  /**
   * Start listening (owned by session).
   * For guided flows, prefer requestListening() (single turn).
   */
  start(opts: ListenOptions = { language: 'en-US', continuous: false }): void {
    // If we already have an active STT subscription, don’t double-start.
    // (This is the exact “lock” that was blocking account_id.)
    if (this.isStarted) {
      this.lastListenOpts = { ...opts };
      return;
    }

    this.isStarted = true;
    this.owningMic = true;
    this.lastListenOpts = { ...opts };

    this.startSttStream();
  }

  /**
   * Stop session-level listening.
   * Clears subscriptions and stops mic.
   */
  stop(): void {
    this.isStarted = false;
    this.stopSttStream();

    // Stop the browser recognition
    this.voice.stop();

    this.telemetry.emit('STT_STOP', {
      ctx: this.activeContextId ?? '-',
      message: 'STT stopped by session'
    });
  }

  /**
   * Session-coordinated speech.
   * We don't manually stop/start STT here — TTS events handle that.
   */
  say(text: string, opts: { rate?: number; pitch?: number; lang?: string } = {}): void {
    this.telemetry.emit('TTS_START', {
      ctx: this.activeContextId ?? '-',
      payload: { text }
    });
    this.tts.speak(text, opts);
  }

  // ------------------------------------------------------------
  // Guided Flow Helper (THIS is what your context should call)
  // ------------------------------------------------------------

  /**
   * Request a single-turn listen for the ACTIVE context.
   * This is the safe re-arm API for guided flows.
   *
   * IMPORTANT:
   * - If we are currently listening, we stop the stream first
   *   so the new step can start cleanly.
   */
  requestListening(opts: ListenOptions = { language: 'en-US', continuous: false }): void {
    if (!this.activeContextId) return;

    this.telemetry.emit('STT_START', {
      ctx: this.activeContextId,
      message: 'Re-arming STT for guided flow'
    });

    // 🔑 If a previous listen is still marked active, tear it down
    // This is the missing piece that was preventing account_id from starting.
    if (this.isStarted) {
      this.stop(); // releases isStarted + unsub + voice.stop()
    }

    // Start fresh single-turn listen
    this.start(opts);
  }

  // ------------------------------------------------------------
  // Internal STT Stream Routing
  // ------------------------------------------------------------

  /**
   * Start a new STT stream subscription.
   * Routes ONLY to active context.
   */
  private startSttStream(): void {
      const token = ++this.streamToken;
      this.stopSttStream();

      let gotFinal = false;

      const activeId = this.activeContextId;

      this.telemetry.emit('STT_START', { ctx: activeId ?? '-' });

      this.sttSub = this.voice
        .startListening(this.lastListenOpts)
        .subscribe({
          next: (text: string) => {
            gotFinal = true;

            this.zone.run(() => {
              const ctx = activeId ? this.contexts.get(activeId) : null;

              this.telemetry.emit('STT_FINAL', {
                ctx: activeId ?? '-',
                payload: { text }
              });

              ctx?.onFinal(text);
            });
          },

          error: (err) => {
            this.telemetry.emit('ERROR', {
              ctx: activeId ?? '-',
              message: 'STT stream error',
              payload: { err: String(err) }
            });
          },

          complete: () => {
            // 🔁 IMPORTANT: retry if silence
            if (!gotFinal && this.owningMic && this.activeContextId === activeId) {
              this.telemetry.emit('STT_RETRY', {
                ctx: activeId,
                message: 'No speech detected, retrying guided step'
              });

              this.startSttStream();
            }
          }
        });
    }


  /**
   * Stop + clear the subscription only (does not call voice.stop()).
   * Use stop() when you want to stop recognition too.
   */
  private stopSttStream(): void {
    try {
      this.sttSub?.unsubscribe();
    } catch {}

    this.sttSub = undefined;
  }

  // ------------------------------------------------------------
  // TTS Event Coordination (no timeouts)
  // ------------------------------------------------------------

  /**
   * When TTS starts, abort recognition if we were listening.
   */
  private onTtsStarted(): void {
    this.telemetry.emit('TTS_START', {
      ctx: this.activeContextId ?? '-',
      message: 'TTS started (event)'
    });

    if (!this.owningMic) return;

    // If mic is currently listening, pause it during TTS
    if (this.voice.isListening$.value) {
      this.pendingResumeAfterTts = true;

      // Abort recognition cleanly
      this.voice.stopListeningDuringTTS();

      // Also stop stream subscription (prevents dead subscribers)
      this.stopSttStream();

      // Release lock so a guided flow can re-arm after TTS ends
      this.isStarted = false;
    }
  }

  /**
   * When TTS ends, we resume only if we had paused due to TTS.
   * NOTE: For guided flows, you will explicitly call requestListening()
   * after TTS_END inside your context. So we do NOT auto-resume here.
   */
  private onTtsEnded(): void {
    this.telemetry.emit('TTS_END', {
      ctx: this.activeContextId ?? '-',
      message: 'TTS ended (event)'
    });

    if (!this.owningMic) return;

    // If you want auto-resume for continuous contexts, you can enable this:
    const ctxId = this.activeContextId;
    const ctx = ctxId ? this.contexts.get(ctxId) : null;

    if (this.pendingResumeAfterTts && ctx?.wantsListening) {
      this.pendingResumeAfterTts = false;

      // Resume continuous listening
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
//  handleMicRequest(): void {
//      const id = this.activeContextId;
//      if (!id) return;
//
//      const ctx = this.contexts.get(id);
//      if (!ctx) return;
//
//      this.telemetry.emit('STT_START', {
//        ctx: id,
//        message: 'Mic request forwarded to context'
//      });
//
//      ctx.onMicRequest?.();
//  }
}
