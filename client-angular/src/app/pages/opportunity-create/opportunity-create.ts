import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';

import { OpportunityService } from '../../services/opportunity.service';
import { OpportunityMetadata, OpportunityCreateRequest } from '../../models/opportunity.model';
import { VoiceService } from '../../services/voice-service';
import { VoiceOpportunityService } from '../../services/voice/voice-opportunity.service';

@Component({
  selector: 'app-opportunity-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './opportunity-create.html',
  styleUrls: ['./opportunity-create.scss']
})
export class OpportunityCreateComponent implements OnInit, OnDestroy {

  form!: FormGroup;

  metadata = signal<OpportunityMetadata | null>(null);
  loading = signal(false);
  error   = signal<string | null>(null);
  success = signal<string | null>(null);

  // which field is currently being filled by voice
  activeVoiceField = signal<string | null>(null);

  private voiceSub?: Subscription;
  private guidedSub?: Subscription;

  constructor(
    private fb: FormBuilder,
    private oppService: OpportunityService,
    private voice: VoiceService,
    private voiceOpp: VoiceOpportunityService
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.loadMetadata();

 // 🔥 connect guided flow callback → update Angular form + submit signal
    this.voiceOpp.onFieldCaptured = (field: string, value: string) => {
      console.log("📝 Guided field captured:", field, value);

      if (field === '__submit__') {
        // guided flow decided it's time to submit
        this.onSubmit();
        return;
      }

      const ctrl = this.form.get(field);
      if (ctrl) {
        ctrl.setValue(value.trim());
      }

      this.activeVoiceField.set(null);
    };
  }

  ngOnDestroy(): void {
    this.voiceSub?.unsubscribe();
    this.guidedSub?.unsubscribe();
    this.voice.stop();
  }

  private buildForm(): void {

  const format = (d: Date): string => {
    return d.toISOString().split("T")[0];
  };

  const today = new Date();
  const todayStr = format(today);

  // today + 30 days
  const plus30 = new Date();
  plus30.setDate(today.getDate() + 30);
  const plus30Str = format(plus30);

  this.form = this.fb.group({
    opportunity_name: ['', Validators.required],
    account_id: ['', Validators.required],
    primary_contact_id: [''],
    owner_id: [''],
    stage: ['', Validators.required],
    status: ['', Validators.required],
    is_closed: [false],
    is_won: [false],

    // ✅ these must be YYYY-MM-DD STRINGS
    expected_close_date: [plus30Str],
    close_date: [plus30Str],
    last_activity_date: [todayStr],
    last_contacted_date: [todayStr],
    next_activity_date: [todayStr],

    amount: [],
    currency: ['', Validators.required],
    probability: [],
    forecast_category: ['Pipeline'],
    expected_revenue: [null],
    lead_source: ['Inbound'],
    campaign_id: [''],
    priority: ['Medium'],
    next_step: ['Follow up on 15/30/2025'],
    deal_type: ['New Business'],
    pipeline_id: ['PL-SaaS-2025'],

    description: ['positive'],
    pain_points: ['N/A'],
    customer_needs: ['Fast delivery'],
    value_proposition: ['80/20'],
    win_reason: ['N/A'],
    loss_reason: ['N/A'],
    record_type: ['Sales Opportunity'],
    tags: ['new proposal'],
    engagement_score: [0]
  });
}


  private loadMetadata(): void {
    this.oppService.getMetadata().subscribe({
      next: meta => {
        console.log('📊 Opportunity metadata:', meta);
        this.metadata.set(meta);
      },
      error: err => {
        console.error('Failed to load metadata, using defaults.', err);
        this.metadata.set(null);
      }
    });
  }

  // 🔊 Manual per-field dictation (kept as-is)
  startVoiceForField(field: string): void {
    this.activeVoiceField.set(field);
    this.error.set(null);

    this.voiceSub?.unsubscribe();

    this.voiceSub = this.voice.startListening({
      language: 'en-US',
      continuous: false
    })
    .subscribe({
      next: (text: string) => {
        const trimmed = text.trim();
        console.log(`🎤 Voice for ${field}:`, trimmed);

        if (!trimmed) return;

        const ctrl = this.form.get(field);
        if (!ctrl) return;

        if (['amount', 'probability', 'expected_revenue', 'engagement_score'].includes(field)) {
          const num = Number(trimmed.replace(/[^0-9.-]/g, ''));
          ctrl.setValue(isNaN(num) ? null : num);
        } else if (['is_closed', 'is_won'].includes(field)) {
          const lower = trimmed.toLowerCase();
          ctrl.setValue(lower.includes('yes') || lower.includes('true'));
        } else {
          ctrl.setValue(trimmed);
        }

        this.voice.stop();
        this.activeVoiceField.set(null);
      },
      error: err => {
        console.error('Voice error:', err);
        this.activeVoiceField.set(null);
      }
    });
  }

  stopVoice(): void {
    this.voice.stop();
    this.activeVoiceField.set(null);
    this.voiceSub?.unsubscribe();
  }

  // 🚀 Submit to FastAPI
  onSubmit(): void {
    console.log(" --------- onSubmit method called class OpportunityCreateComponent ---------")
    this.error.set(null);
    this.success.set(null);

    if (this.form.invalid) {
      this.error.set('Please fill all required fields.');
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.value;

    const normalizeDate = (v: any): string | null =>
      v ? new Date(v).toISOString().slice(0, 10) : null;

    const payload: OpportunityCreateRequest = {
      ...raw,
      expected_close_date: normalizeDate(raw.expected_close_date),
      close_date: normalizeDate(raw.close_date),
      last_activity_date: normalizeDate(raw.last_activity_date),
      last_contacted_date: normalizeDate(raw.last_contacted_date),
      next_activity_date: normalizeDate(raw.next_activity_date),
      amount: raw.amount != null ? Number(raw.amount) : null,
      probability: raw.probability != null ? Number(raw.probability) : null,
      expected_revenue: raw.expected_revenue != null ? Number(raw.expected_revenue) : null,
      engagement_score: raw.engagement_score != null ? Number(raw.engagement_score) : null
    };

    console.log('🚀 Submitting opportunity payload:', payload);

    this.loading.set(true);
    this.oppService.createOpportunity(payload).subscribe({
      next: res => {
        this.loading.set(false);
        console.log('✅ Opportunity created:', res);
        this.success.set('Opportunity created successfully.');
      },
      error: err => {
        this.loading.set(false);
        console.error('❌ Failed to create opportunity:', err);
        this.error.set('Failed to create opportunity.');
      }
    });
  }
}
