import { VoiceSessionService } from '../voice-session.service';
import { VoiceTelemetryService } from '../voice-telemetry.service';
import { TtsService } from '../../tts.service';
import { FormGroup } from '@angular/forms';
import { VoiceContext } from '../voice-session.service';
import { OpportunityService } from '../../opportunity.service';
import { OpportunityCreateRequest } from '../../../models/opportunity.model';

export function createOpportunityCreateVoiceContext(deps: {
  telemetry: VoiceTelemetryService;
  tts: TtsService;
  form: FormGroup;
  voiceSession: VoiceSessionService;
  opportunityService: OpportunityService;
}): VoiceContext {

  type Step =
    | 'idle'
    | 'opportunity_name'
    | 'account_id'
    | 'primary_contact_id'
    | 'owner_id'
    | 'amount'
    | 'close_date'
    | 'confirm_submit'
    | 'done';

  // let step: Step = 'opportunity_name';
     let step: Step = 'idle';

  function isStartOpportunityCommand(text: string): boolean {
  const u = text.toLowerCase();
    return (
      u.includes('create opportunity') ||
      u.includes('new opportunity') ||
      u.includes('start opportunity') ||
      u.includes('create new opportunity')
    );
  }


  function parseAmount(text: string): number | null {
    const t = (text ?? '').toLowerCase().replace(/[,]/g, '').trim();
    const digitMatch = t.match(/\d+/g);
    if (!digitMatch) return null;

    let num = Number(digitMatch.join(''));
    if (isNaN(num)) return null;

    if (t.includes('thousand')) num *= 1_000;
    if (t.includes('million')) num *= 1_000_000;
    return num;
  }

  function parseDate(text: string): string | null {
    // accept ISO yyyy-mm-dd directly
    const iso = (text ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;

    const d = new Date(text);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }

  function norm(s: string): string {
    return (s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
  }

  function isYes(text: string): boolean {
    const u = norm(text);
    return (
      u === 'yes' ||
      u === 'yeah' ||
      u === 'yep' ||
      u === 'confirm' ||
      u === 'submit' ||
      u === 'go ahead' ||
      u === 'okay submit' ||
      u.includes('yes submit') ||
      u.includes('submit it')
    );
  }

  function isNo(text: string): boolean {
    const u = norm(text);
    return (
      u === 'no' ||
      u === 'nope' ||
      u === 'cancel' ||
      u === 'stop' ||
      u === 'do not submit' ||
      u.includes("don't submit") ||
      u.includes('not now')
    );
  }

  type PromptStep = Exclude<
  Step,
  'idle' | 'confirm_submit' | 'done'
>;

const STEPS: Record<
  PromptStep,
  {
    prompt: string;
    patch: (value: string) => boolean;
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


  function speakThenListen(prompt: string): void {
    deps.tts.speak(prompt);
    document.addEventListener(
      'tts-ended',
      function onEnd() {
        document.removeEventListener('tts-ended', onEnd);
        deps.voiceSession.requestListening({ language: 'en-US', continuous: false });
      },
      { once: true }
    );
  }

  function promptStep(): void {
    if (step === 'confirm_submit') {
      const summary = buildQuickSummaryForVoice();
      speakThenListen(`${summary}. Do you want me to submit? Say yes or no.`);
      return;
    }

    const cfg = STEPS[step as keyof typeof STEPS];
    if (!cfg) return;

    speakThenListen(cfg.prompt);
  }

  function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  function buildPayload(): OpportunityCreateRequest {
    const v = deps.form.value;
    const today = todayIso();

    return {
      opportunity_name: v.opportunity_name ?? '',
      account_id: v.account_id ?? '',
      primary_contact_id: v.primary_contact_id ?? '',
      owner_id: v.owner_id ?? '',

      stage: v.stage ?? 'Prospecting',
      status: v.status ?? 'Open',
      is_closed: v.is_closed ?? false,
      is_won: v.is_won ?? false,

      expected_close_date: v.expected_close_date || v.close_date || today,
      close_date: v.close_date || today,

      amount: v.amount ?? 0,
      currency: v.currency ?? 'USD',
      probability: v.probability ?? 10,

      forecast_category: v.forecast_category ?? 'Pipeline',
      expected_revenue: v.expected_revenue ?? (v.amount ?? 0),
      lead_source: v.lead_source ?? 'Voice',
      campaign_id: v.campaign_id ?? '',
      priority: v.priority ?? 'Medium',
      next_step: v.next_step ?? '',
      deal_type: v.deal_type ?? 'New Business',
      pipeline_id: v.pipeline_id ?? 'DEFAULT',

      description: v.description ?? '',
      pain_points: v.pain_points ?? '',
      customer_needs: v.customer_needs ?? '',
      value_proposition: v.value_proposition ?? '',
      win_reason: v.win_reason ?? '',
      loss_reason: v.loss_reason ?? '',
      record_type: v.record_type ?? 'Standard',
      tags: v.tags ?? 'voice',

      last_activity_date: v.last_activity_date || today,
      last_contacted_date: v.last_contacted_date || today,
      next_activity_date: v.next_activity_date || today,
      engagement_score: v.engagement_score ?? 0
    };
  }

  function buildQuickSummaryForVoice(): string {
    const v = deps.form.value;
    const name = v.opportunity_name || 'an opportunity';
    const acct = v.account_id ? `account ${v.account_id}` : 'no account';
    const amt = v.amount ? `amount ${v.amount}` : 'no amount';
    const date = v.close_date ? `close date ${v.close_date}` : 'no close date';
    return `I captured ${name}, ${acct}, ${amt}, ${date}`;
  }

  function submit(): void {
    const payload = buildPayload();

    deps.telemetry.emit('FORM_SUBMIT', {
      ctx: 'opportunity-create',
      payload
    });

    deps.opportunityService.createOpportunity(payload).subscribe({
      next: () => {
        deps.tts.speak('Opportunity created successfully.');
        step = 'done';
        deps.voiceSession.setActive(undefined);
      },
      error: (err) => {
        deps.telemetry.emit('ERROR', {
          ctx: 'opportunity-create',
          message: 'Opportunity create failed',
          payload: { err: String(err) }
        });
        speakThenListen('Sorry, I could not create the opportunity. Do you want me to try again? Say yes or no.');
        // we reuse confirm_submit as retry confirm
        step = 'confirm_submit';
      }
    });
  }

  return {
    id: 'opportunity-create',
    wantsListening: true,

    onActivate() {
      step = 'idle';

      deps.telemetry.emit('CTX_SET_ACTIVE', {
        ctx: 'opportunity-create',
        message: 'Opportunity page active – waiting for start command'
      });

      // ❌ DO NOT prompt here
      // ❌ DO NOT speak here
    },

    onFinal(text: string) {
      const value = (text ?? '').trim();
      if (!value) return;

      deps.telemetry.emit('STT_FINAL', {
        ctx: 'opportunity-create',
        payload: { step, text: value }
      });

      /* -------------------------------------------------
      * 💤 IDLE → wait for explicit START command
      * ------------------------------------------------- */
      if (step === 'idle') {
        if (isStartOpportunityCommand(value)) {
          deps.telemetry.emit('FLOW_START', {
            ctx: 'opportunity-create'
          });

          step = 'opportunity_name';

          deps.tts.speak('Starting opportunity creation.');
          promptStep();
        }
        // ⛔ ignore everything else while idle
        return;
      }

      /* -------------------------------------------------
      * ❓ CONFIRM SUBMIT
      * ------------------------------------------------- */
      if (step === 'confirm_submit') {
        if (isYes(value)) {
          submit();
          return;
        }

        if (isNo(value)) {
          deps.tts.speak(
            'Okay. I will not submit. You can review or say start opportunity again.'
          );
          step = 'done';
          deps.voiceSession.setActive(undefined);
          return;
        }

        speakThenListen('Please say yes to submit or no to cancel.');
        return;
      }

      /* -------------------------------------------------
      * 🧩 NORMAL STEP HANDLING
      * ------------------------------------------------- */
      const cfg = STEPS[step as keyof typeof STEPS];
      if (!cfg) return;

      const ok = cfg.patch(value);
      if (!ok) {
        speakThenListen('I did not understand. Please say it again.');
        return;
      }

      /* -------------------------------------------------
      * ➡️ ADVANCE FLOW
      * ------------------------------------------------- */
      const order: Step[] = [
        'opportunity_name',
        'account_id',
        'primary_contact_id',
        'owner_id',
        'amount',
        'close_date',
        'confirm_submit'
      ];

      const next = order[order.indexOf(step) + 1];

      if (!next) {
        step = 'done';
        deps.voiceSession.setActive(undefined);
        return;
      }

      step = next;

      if (step === 'confirm_submit') {
        speakThenListen('Do you want me to submit this opportunity?');
        return;
      }
      promptStep();
    }
  };
}