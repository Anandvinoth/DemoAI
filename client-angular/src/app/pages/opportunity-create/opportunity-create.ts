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
import { OpportunityService } from '../../services/opportunity.service';

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
  // private sub?: Subscription;

  constructor(
    private fb: FormBuilder,
    private voice: VoiceService,
    private tts: TtsService,
    private oppVoice: OpportunityVoiceService,
    private voiceCtx: VoiceContextService,
    private voiceSession: VoiceSessionService,
    private telemetry: VoiceTelemetryService,
    private opportunityService:OpportunityService
  ) {
    const today = new Date().toISOString().slice(0, 10);

this.form = this.fb.group({
  opportunity_name: [''],
  account_id: [''],
  primary_contact_id: [''],
  owner_id: [''],

  // defaults
  stage: ['Prospecting'],
  status: ['Open'],
  is_closed: [false],
  is_won: [false],

  amount: [0],
  currency: ['USD'],
  probability: [10],
  expected_revenue: [0],

  expected_close_date: [today],
  close_date: [today],
  last_activity_date: [today],
  last_contacted_date: [today],
  next_activity_date: [today],

  forecast_category: ['Pipeline'],
  lead_source: ['Voice'],
  priority: ['Medium'],
  deal_type: ['New Business'],
  pipeline_id: ['PL-SaaS-2025'],
  record_type: ['Sales Opportunity'],

  campaign_id: ['N/A'],
  description: ['No description provided'],
  pain_points: ['Not identified yet'],
  customer_needs: ['To be determined'],
  value_proposition: ['Not defined'],
  next_step: ['Follow up required'],
  win_reason: ['Pending outcome'],
  loss_reason: ['Pending outcome'],
  tags: ['voice'],
  engagement_score: [0]
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
        voiceSession: this.voiceSession,   // ✅ PASS IT
        opportunityService:this.opportunityService
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
  // private promptCurrentField(): void {
  //   const field = this.oppVoice.getCurrentField();
  //   if (!field) return;

  //   this.oppVoice.state = OpportunityVoiceState.PROMPTING;

  //   this.voice.stop();
  //   this.tts.speak(field.prompt);
  //   this.startListening();
  // }

  // private startListening(): void {
  //   this.oppVoice.state = OpportunityVoiceState.LISTENING;

  //   this.sub?.unsubscribe();
  //   this.sub = this.voice
  //     .startListening({ language: 'en-US', continuous: false })
  //     .subscribe({
  //       next: text => {
  //         console.log('🎙️ STT heard:', text);
  //         this.handleFinal(text);
  //       },
  //       error: err => {
  //         console.error('STT error', err);
  //         this.promptCurrentField();
  //       }
  //     });
  // }

  // private handleFinal(text: string): void {
  //   this.voice.stop();

  //   const result = this.oppVoice.interpretFinalResult(text);
  //   if (!result.valid) {
  //     this.promptCurrentField();
  //     return;
  //   }

  //   const field = this.oppVoice.getCurrentField();
  //   this.form.patchValue({ [field.id]: result.value });

  //   this.tts.speak(`Set ${field.id.replace('_', ' ')} to ${result.value}`);

  //   const hasNext = this.oppVoice.advance();
  //   hasNext ? this.promptCurrentField() : this.finish();
  // }

  // private finish(): void {
  //   this.tts.speak('Opportunity voice capture completed');
  //   console.log('Voice data:', this.form.value);
  // }

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
