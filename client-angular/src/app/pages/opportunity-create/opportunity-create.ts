// src/app/pages/opportunity-create/opportunity-create.ts
import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';

import { VoiceService } from '../../services/voice-service';
import { TtsService } from '../../services/tts.service';
import { VoiceContextService } from '../../services/voice/voice-context.service';
import { VoiceSessionService } from '../../services/voice/voice-session.service';
import { VoiceTelemetryService } from '../../services/voice/voice-telemetry.service';
import { createOpportunityCreateVoiceContext } from '../../services/voice/contexts/opportunity-create.voice.context';

import {
  OpportunityVoiceService,
  OpportunityVoiceState
} from './opportunity-voice.service';

interface OpportunityMetadata {
  stage: string[];
  status: string[];
  currency: string[];
  forecast_category: string[];
  lead_source: string[];
  priority: string[];
  deal_type: string[];
  pipeline_id: string[];
  record_type: string[];
}

@Component({
  selector: 'app-opportunity-create',
  standalone: true,
  templateUrl: './opportunity-create.html',
  styleUrls: ['./opportunity-create.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule
  ]
})
export class OpportunityCreateComponent implements OnInit, OnDestroy {

  // ----------------------------
  // TEMPLATE STATE
  // ----------------------------
  form: FormGroup;

  error   = signal<string | null>(null);
  success = signal<string | null>(null);
  loading = signal<boolean>(false);

  // ----------------------------
  // VOICE
  // ----------------------------
  private sub?: Subscription;

  constructor(
    private fb: FormBuilder,
    private voice: VoiceService,
    private tts: TtsService,
    private oppVoice: OpportunityVoiceService,
    private voiceCtx: VoiceContextService,
    private voiceSession: VoiceSessionService,
    private telemetry: VoiceTelemetryService
  ) {
    this.form = this.fb.group({
      opportunity_name: [''],
      account_id: [''],
      primary_contact_id: [''],
      owner_id: [''],

      stage: [''],
      status: [''],
      is_closed: [false],
      is_won: [false],

      amount: [''],
      currency: ['USD'],
      probability: [''],
      expected_revenue: [''],

      expected_close_date: [''],
      close_date: [''],
      last_activity_date: [''],
      last_contacted_date: [''],
      next_activity_date: [''],

      forecast_category: [''],
      lead_source: [''],
      priority: [''],
      deal_type: [''],
      pipeline_id: [''],
      record_type: [''],

      description: [''],
      pain_points: [''],
      customer_needs: [''],
      value_proposition: [''],
      next_step: [''],
      win_reason: [''],
      loss_reason: [''],
      tags: [''],
      engagement_score: ['']
    });
  }

  // ----------------------------
  // LIFECYCLE
  // ----------------------------
  ngOnInit(): void {
      const ctx = createOpportunityCreateVoiceContext({
        telemetry: this.telemetry,
        tts: this.tts,
        form: this.form,
        voiceSession: this.voiceSession   // ✅ PASS IT
      });

      this.voiceSession.register(ctx);
      this.voiceSession.setActive('opportunity-create');
    }

  ngOnDestroy(): void {
      this.voiceSession.unregister('opportunity-create');
      // optional: stop session listening when leaving page, or let products start manually
      this.voiceSession.stop();
    }


  // ----------------------------
  // VOICE FLOW
  // ----------------------------
  private promptCurrentField(): void {
    const field = this.oppVoice.getCurrentField();
    if (!field) return;

    this.oppVoice.state = OpportunityVoiceState.PROMPTING;

    this.voice.stop();
    this.tts.speak(field.prompt);
    this.startListening();
  }

  private startListening(): void {
    this.oppVoice.state = OpportunityVoiceState.LISTENING;

    this.sub?.unsubscribe();
    this.sub = this.voice
      .startListening({ language: 'en-US', continuous: false })
      .subscribe({
        next: text => {
          console.log('🎙️ STT heard:', text);
          this.handleFinal(text);
        },
        error: err => {
          console.error('STT error', err);
          this.promptCurrentField();
        }
      });
  }

  private handleFinal(text: string): void {
    this.voice.stop();

    const result = this.oppVoice.interpretFinalResult(text);
    if (!result.valid) {
      this.promptCurrentField();
      return;
    }

    const field = this.oppVoice.getCurrentField();
    this.form.patchValue({ [field.id]: result.value });

    this.tts.speak(`Set ${field.id.replace('_', ' ')} to ${result.value}`);

    const hasNext = this.oppVoice.advance();
    hasNext ? this.promptCurrentField() : this.finish();
  }

  private finish(): void {
    this.tts.speak('Opportunity voice capture completed');
    console.log('Voice data:', this.form.value);
  }

  // ----------------------------
  // TEMPLATE HOOKS
  // ----------------------------
  metadata(): OpportunityMetadata | null {
    return null;
  }

  onSubmit(): void {
    this.loading.set(true);
    console.log('Submitting opportunity:', this.form.value);
    this.loading.set(false);
    this.success.set('Opportunity created successfully');
  }

  stopVoice(): void {
    this.voice.stop();
    this.tts.stop?.();
  }
}
