// src/app/services/voice/voice-telemetry.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Telemetry event types for monitoring "who did what, when" in the voice layer.
 * Keep this small now; we can extend later without breaking anything.
 */
export type VoiceEventType =
  | 'SESSION_START'
  | 'CTX_REGISTER'
  | 'CTX_SET_ACTIVE'
  | 'CTX_DEACTIVATE'
  | 'CTX_CLEAR'
  | 'CTX_UNREGISTER'   // ✅ ADD THIS
  | 'STT_START'
  | 'STT_FINAL'
  | 'STT_STOP'
  | 'TTS_START'
  | 'API_ROUTE'
  | 'STT_ROUTE'
  | 'STT_FORWARD'
  | 'STT_RECOVER'
  | 'STT_RESTART'
  | 'STT_DROP_ECHO'
  | 'TTS_END'
  | 'ERROR'
  | 'STT_RETRY'
  // business / workflow telemetry
  | 'FORM_DEFAULTS'
  | 'FORM_SUBMIT'
  | 'FLOW_START';


export interface VoiceTelemetryEvent {
  ts: number;                 // epoch ms
  sessionId: string;          // per app instance / per tab
  tabId: string;              // per tab
  userId?: string;            // optional (Keycloak later)
  ctx?: string;               // active context id (products/orders/opportunity-create)
  type: VoiceEventType;
  message?: string;           // optional human friendly text
  payload?: any;              // structured data for DB / debugging
}

/**
 * VoiceTelemetryService:
 * - Generates stable sessionId/tabId for this Angular app instance (per browser tab)
 * - Emits structured logs
 * - Stores events in-memory for demo UI (journey panel)
 * - Later we can forward to backend (DB) without changing callers
 */
@Injectable({ providedIn: 'root' })
export class VoiceTelemetryService {
  private readonly _sessionId: string;
  private readonly _tabId: string;

  private readonly eventsSubject = new BehaviorSubject<VoiceTelemetryEvent[]>([]);
  readonly events$ = this.eventsSubject.asObservable();

  /** If you later want to disable console logs in prod, flip this. */
  private consoleEnabled = true;

  constructor() {
    // sessionId: per app instance/tab. tabId is separate so you can track multi-tab later.
    this._sessionId = this.safeUuid('voice_session_id');
    this._tabId = this.safeUuid('voice_tab_id');

    this.emit('SESSION_START', {
      message: 'Voice telemetry session started',
      payload: { userAgent: navigator.userAgent }
    });
  }

  /** Stable IDs (per tab) stored in sessionStorage so reload keeps same id. */
  private safeUuid(key: string): string {
    try {
      const existing = sessionStorage.getItem(key);
      if (existing) return existing;

      const id =
        (crypto as any)?.randomUUID?.() ??
        `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;

      sessionStorage.setItem(key, id);
      return id;
    } catch {
      // If sessionStorage blocked, fallback to runtime id
      return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    }
  }

  get sessionId(): string { return this._sessionId; }
  get tabId(): string { return this._tabId; }

  /**
   * Emit an event:
   * - Appends to in-memory list (demo panel)
   * - Writes structured log lines to console
   * - Can later be forwarded to backend
   */
  emit(type: VoiceEventType, args: {
    ctx?: string;
    userId?: string;
    message?: string;
    payload?: any;
  } = {}): void {
    const ev: VoiceTelemetryEvent = {
      ts: Date.now(),
      sessionId: this._sessionId,
      tabId: this._tabId,
      userId: args.userId,
      ctx: args.ctx,
      type,
      message: args.message,
      payload: args.payload
    };

    // store in memory
    const current = this.eventsSubject.value;
    this.eventsSubject.next([...current, ev]);

    // console log (single-line, grep-friendly)
    if (this.consoleEnabled) {
      const prefix = `[voice][sid=${this._sessionId.slice(0, 6)}][tab=${this._tabId.slice(0, 6)}][ctx=${args.ctx ?? '-'}]`;
      const msg = args.message ? ` ${args.message}` : '';
      console.log(`${prefix} ${type}${msg}`, args.payload ?? '');
    }
  }
}
