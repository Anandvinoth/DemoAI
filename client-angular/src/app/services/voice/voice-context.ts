// src/app/voice/voice-context.ts

export interface VoiceContext {
  /** Unique context id */
  readonly id: string;

  /** Continuous listening intent */
  readonly wantsListening: boolean;

  /** Called when this context becomes active */
  onActivate(): void;

  /** Called when this context is deactivated */
  onDeactivate(): void;

  /** Receives STT final text ONLY when active */
  onFinal(text: string): void;
}
