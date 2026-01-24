import { VoiceContext } from '../voice-session.service';
import { VoiceTelemetryService } from '../voice-telemetry.service';
import { VoiceSessionService } from '../voice-session.service';
import { VoiceContextService } from '../voice-context.service';

export function createOrdersVoiceContext(deps: {
  telemetry: VoiceTelemetryService;
  voiceSession: VoiceSessionService;
  voiceCtx: VoiceContextService;   // ✅ ADD THIS
}): VoiceContext {
  return {
    id: 'orders',
    wantsListening: true,

    onActivate() {
      deps.telemetry.emit('CTX_SET_ACTIVE', {
        ctx: 'orders',
        message: 'Orders voice context activated'
      });

      // ✅ THIS IS THE MISSING PIECE
      deps.voiceCtx.setMode('orders');

      // Orders own the mic
      deps.voiceSession.start({
        language: 'en-US',
        continuous: true
      });
    },

    onFinal(text: string) {
      // Correct: Orders NLP lives elsewhere
      deps.telemetry.emit('STT_FORWARD', {
        ctx: 'orders',
        payload: { text }
      });
    }
  };
}
