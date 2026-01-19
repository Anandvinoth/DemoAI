import { VoiceSessionService } from '../voice-session.service';
import { VoiceTelemetryService } from '../voice-telemetry.service';
import { TtsService } from '../../tts.service';
import { FormGroup } from '@angular/forms';
import { VoiceContext } from '../voice-session.service';

/**
 * Guided voice context for Opportunity Create page.
 * Owns TTS → STT lifecycle and patches the reactive form.
 */
export function createOpportunityCreateVoiceContext(deps: {
  telemetry: VoiceTelemetryService;
  tts: TtsService;
  form: FormGroup;
  voiceSession: VoiceSessionService;
}): VoiceContext {

  // -----------------------------
  // Step model
  // -----------------------------
  type Step =
    | 'opportunity_name'
    | 'account_id'
    | 'primary_contact_id'
    | 'owner_id'
    | 'amount'
    | 'close_date'
    | 'submit'
    | 'done';

  let step: Step = 'opportunity_name';

  // -----------------------------
  // Normalization helpers
  // -----------------------------
  function parseAmount(text: string): number | null {
    const t = text.toLowerCase().replace(/[,]/g, '').trim();

    const digitMatch = t.match(/\d+/g);
    if (digitMatch) {
      let num = Number(digitMatch.join(''));
      if (t.includes('thousand')) num *= 1_000;
      if (t.includes('million')) num *= 1_000_000;
      return isNaN(num) ? null : num;
    }

    if (t.includes('hundred thousand')) return 100_000;
    if (t.includes('million')) return 1_000_000;
    if (t.includes('thousand')) return 1_000;

    return null;
  }

  function parseDate(text: string): string | null {
    const d = new Date(text);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10); // yyyy-MM-dd
  }

  // -----------------------------
  // Step → Prompt + Patch logic
  // -----------------------------
  const STEPS: Record<
    Exclude<Step, 'submit' | 'done'>,
    {
      prompt: string;
      patch: (value: string) => boolean; // return success/failure
    }
  > = {
    opportunity_name: {
      prompt: 'What is the opportunity name?',
      patch: v => {
        deps.form.patchValue({ opportunity_name: v });
        return true;
      }
    },
    account_id: {
      prompt: 'What is the account ID?',
      patch: v => {
        deps.form.patchValue({ account_id: v });
        return true;
      }
    },
    primary_contact_id: {
      prompt: 'What is the primary contact ID?',
      patch: v => {
        deps.form.patchValue({ primary_contact_id: v });
        return true;
      }
    },
    owner_id: {
      prompt: 'Who is the owner?',
      patch: v => {
        deps.form.patchValue({ owner_id: v });
        return true;
      }
    },
    amount: {
      prompt: 'What is the deal amount?',
      patch: v => {
        const parsed = parseAmount(v);
        if (parsed == null) return false;
        deps.form.patchValue({ amount: parsed });
        return true;
      }
    },
    close_date: {
      prompt: 'What is the expected close date?',
      patch: v => {
        const parsed = parseDate(v);
        if (!parsed) return false;
        deps.form.patchValue({ close_date: parsed });
        return true;
      }
    }
  };

  // -----------------------------
  // Speak → then listen
  // -----------------------------
  function promptStep(): void {
    const cfg = STEPS[step as keyof typeof STEPS];
    if (!cfg) return;

    deps.telemetry.emit('TTS_START', {
      ctx: 'opportunity-create',
      payload: { step, prompt: cfg.prompt }
    });

    deps.tts.speak(cfg.prompt);

    document.addEventListener('tts-ended', function onEnd() {
      document.removeEventListener('tts-ended', onEnd);
      deps.voiceSession.requestListening({
        language: 'en-US',
        continuous: false
      });
    });
  }

  // -----------------------------
  // Defaults (bottom panels)
  // -----------------------------
  function applyDefaults(): void {
    deps.form.patchValue({
      stage: 'Prospecting',
      status: 'Open',
      currency: 'USD',
      probability: 10,
      forecast_category: 'Pipeline',
      priority: 'Medium',
      deal_type: 'New Business'
    });

    deps.telemetry.emit('FORM_DEFAULTS', {
      ctx: 'opportunity-create',
      payload: deps.form.value
    });
  }

  // -----------------------------
  // Submit
  // -----------------------------
  function submit(): void {
    applyDefaults();

    deps.telemetry.emit('FORM_SUBMIT', {
      ctx: 'opportunity-create',
      payload: deps.form.value
    });

    deps.tts.speak('Opportunity created successfully.');
    step = 'done';
    deps.voiceSession.setActive(undefined);
  }

  // -----------------------------
  // Context implementation
  // -----------------------------
  return {
    id: 'opportunity-create',
    wantsListening: false,

    onActivate() {
      step = 'opportunity_name';

      deps.telemetry.emit('CTX_SET_ACTIVE', {
        ctx: 'opportunity-create',
        message: 'Opportunity create flow started'
      });

      promptStep();
    },

    onFinal(text: string) {
      const value = text?.trim();
      if (!value) return;

      deps.telemetry.emit('STT_FINAL', {
        ctx: 'opportunity-create',
        payload: { step, text: value }
      });

      const cfg = STEPS[step as keyof typeof STEPS];
      if (!cfg) return;

      const ok = cfg.patch(value);

      if (!ok) {
        deps.tts.speak('I did not understand. Please say it again.');
        promptStep();
        return;
      }

      const order: Step[] = [
        'opportunity_name',
        'account_id',
        'primary_contact_id',
        'owner_id',
        'amount',
        'close_date',
        'submit'
      ];

      step = order[order.indexOf(step) + 1];

      if (step === 'submit') {
        submit();
        return;
      }

      promptStep();
    }
  };
}
