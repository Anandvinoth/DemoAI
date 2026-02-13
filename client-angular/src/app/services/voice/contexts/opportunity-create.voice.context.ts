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

  /* -------------------------------------------------
   * STEP DEFINITION (DEMO-DRIVEN)
   * ------------------------------------------------- */
  type Step =
    | 'opportunity_name'
    | 'account_id'
    | 'primary_contact_id'
    | 'owner_id'
    | 'amount'
    | 'close_date'
    | 'confirm_submit'
    | 'done';

  let step: Step = 'opportunity_name';
  let confirmPromptFinished = false;


  /* -------------------------------------------------
   * HELPERS
   * ------------------------------------------------- */
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

  // function parseDate(text: string): string | null {
  //   const iso = (text ?? '').trim();
  //   if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;

  //   const d = new Date(text);
  //   if (isNaN(d.getTime())) return null;
  //   return d.toISOString().slice(0, 10);
  // }

  function parseDate(text: string): string | null {
    if (!text) return null;

    // 🔑 Remove ordinal suffixes: 1st, 2nd, 3rd, 4th...
    const cleaned = text
      .toLowerCase()
      .replace(/(\d+)(st|nd|rd|th)/g, '$1')
      .trim();

    // ISO format support
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
      return cleaned;
    }

    const d = new Date(cleaned);
    if (isNaN(d.getTime())) return null;

    return d.toISOString().slice(0, 10);
  }

  async function waitUntilTtsIdle(): Promise<void> {
      while (deps.tts.isSpeaking() || deps.tts.isPending()) {
        await new Promise(res => setTimeout(res, 80));
      }
    }

  function isYes(text: string): boolean {
    const u = text.toLowerCase().trim();
    return ['yes', 'yeah', 'yep', 'confirm', 'submit', 'go ahead'].includes(u);
  }

  function isNo(text: string): boolean {
    const u = text.toLowerCase().trim();
    return ['no', 'cancel', 'stop', 'do not submit'].includes(u);
  }

  /* -------------------------------------------------
   * STEP PATCHING LOGIC
   * ------------------------------------------------- */
  const STEPS: Record<
    Exclude<Step, 'confirm_submit' | 'done'>,
    (value: string) => boolean
  > = {
    opportunity_name: v => {
      deps.form.patchValue({ opportunity_name: v });
      return true;
    },

    account_id: v => {
      deps.form.patchValue({ account_id: v });
      return true;
    },

    primary_contact_id: v => {
      deps.form.patchValue({ primary_contact_id: v });
      return true;
    },

    owner_id: v => {
      deps.form.patchValue({ owner_id: v });
      return true;
    },

    amount: v => {
      const parsed = parseAmount(v);
      if (parsed == null) return false;
      deps.form.patchValue({ amount: parsed });
      return true;
    },

    close_date: v => {
      const parsed = parseDate(v);
      if (!parsed) return false;

      deps.form.patchValue({
        expected_close_date: parsed,
        close_date: parsed,
        next_activity_date: plusDaysIso(7)
      });

      return true;
    }
  };

  function plusDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}


  /* -------------------------------------------------
   * SUBMIT
   * ------------------------------------------------- */
  function buildPayload(): OpportunityCreateRequest {
    const v = deps.form.value;
    const today = new Date().toISOString().slice(0, 10);

    return {
      opportunity_name: v.opportunity_name,
      account_id: v.account_id,
      primary_contact_id: v.primary_contact_id,
      owner_id: v.owner_id,
      stage: v.stage,
      status: v.status,
      is_closed: v.is_closed,
      is_won: v.is_won,
      amount: v.amount,
      currency: v.currency,
      probability: v.probability,
      expected_revenue: v.expected_revenue ?? v.amount,
      expected_close_date: v.expected_close_date || v.close_date || '',
      close_date: v.close_date || '',
      forecast_category: v.forecast_category,
      lead_source: v.lead_source,
      priority: v.priority,
      deal_type: v.deal_type,
      pipeline_id: v.pipeline_id,
      record_type: v.record_type,
      campaign_id: v.campaign_id,
      description: v.description,
      pain_points: v.pain_points,
      customer_needs: v.customer_needs,
      value_proposition: v.value_proposition,
      next_step: v.next_step,
      win_reason: v.win_reason,
      loss_reason: v.loss_reason,
      tags: v.tags,
      engagement_score: v.engagement_score,
      last_activity_date: v.last_activity_date || today,
      last_contacted_date: v.last_contacted_date || today,
      next_activity_date: v.next_activity_date || ''
    };
  }

  function submit(): void {
    const payload = buildPayload();

    deps.telemetry.emit('FORM_SUBMIT', {
      ctx: 'opportunity-create',
      payload
    });

    deps.opportunityService.createOpportunity(payload).subscribe({
      next: async () => {
        // 🔑 WAIT until question TTS fully finishes
        await waitUntilTtsIdle();

        await deps.tts.speak('Opportunity created successfully.');

        await waitUntilTtsIdle();

        step = 'done';
        deps.voiceSession.setActive(undefined);
        
        const avatar = document.getElementById('assistant-avatar');
          if (avatar) {
            avatar.style.display = 'none';
          }
        // window.location.href =
        // 'http://localhost:4200/crm/opportunities/list';
        document.dispatchEvent(
          new CustomEvent('opportunity-created-success')
        );
      },
      error: async () => {
        await waitUntilTtsIdle();
        await deps.tts.speak('I could not create the opportunity.');
        step = 'done';
        deps.voiceSession.setActive(undefined);
      }
    });
  }

  /* -------------------------------------------------
   * CONTEXT DEFINITION
   * ------------------------------------------------- */
  return {
    id: 'opportunity-create',
    wantsListening: false, // 🚫 demo mode = no mic

    // onActivate() {
    //   // 🔒 HARD-CODED VALUES
    //   deps.form.patchValue({
    //     account_id: ''
    //   });

    //   step = 'opportunity_name';

    //   deps.telemetry.emit('CTX_SET_ACTIVE', {
    //     ctx: 'opportunity-create',
    //     message: 'Opportunity context active (demo mode)'
    //   });
    // },

    onFinal(text: string) {
      const value = (text ?? '').trim();
      if (!value || step === 'done') return;

      deps.telemetry.emit('STT_FINAL', {
        ctx: 'opportunity-create',
        payload: { step, text: value }
      });

      if (step === 'confirm_submit') {

  // 🚫 Ignore answers until question fully spoken
      if (!confirmPromptFinished) {
        deps.telemetry.emit('CONFIRM_IGNORED_EARLY', {
          ctx: 'opportunity-create',
          payload: { text: value }
        });
        return;
      }

      if (isYes(value)) {
        submit();
        return;
      }

      if (isNo(value)) {
        deps.tts.speak('Okay, I will not submit the opportunity.');
        step = 'done';
        deps.voiceSession.setActive(undefined);
        return;
      }

      return;
    }


      const patch = STEPS[step];
      if (!patch || !patch(value)) return;

      const order: Step[] = [
        'opportunity_name',
        'account_id',
        'primary_contact_id',
        'owner_id',
        'amount',
        'close_date',
        'confirm_submit'
      ];


      step = order[order.indexOf(step) + 1] ?? 'done';
      
      if (step === 'confirm_submit') {
        confirmPromptFinished = false;

        deps.tts.speak('Do you want me to submit this opportunity?');

        document.addEventListener(
          'tts-ended',
          async function onEnd() {
            document.removeEventListener('tts-ended', onEnd);
            confirmPromptFinished = true;

            // 🧑‍✈️ DRIVER answers YES (audible)
            await deps.tts.speakWithVoice(
              'Yes',
              'Google UK English Male',
              { rate: 0.95, pitch: 1.0 }
            );

            // 🔒 Ensure YES finished speaking
            while (deps.tts.isSpeaking() || deps.tts.isPending()) {
              await new Promise(res => setTimeout(res, 80));
            }
            // 🚀 SUBMIT IMMEDIATELY
            submit();
          },
          { once: true }
        );

        return;
      }
    }
  };
}
