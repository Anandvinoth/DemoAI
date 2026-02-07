// src/app/services/voice/demo-drive.service.ts
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { VoiceSessionService } from './voice-session.service';
import { TtsService } from '../tts.service';

type DemoPhase =
  | 'IDLE'
  | 'RUNNING_PRODUCTS'
  | 'HANDOFF_TO_OPPORTUNITY'
  | 'WAITING_OPPORTUNITY_CLICK'
  | 'RUNNING_OPPORTUNITY'
  | 'DONE';

@Injectable({ providedIn: 'root' })
export class DemoDriveService {

  // ----------------------------
  // PRODUCT DEMO (UNCHANGED list)
  // ----------------------------
  private steps = [
    'Get me all the products'
  ];

  private index = 0;
  private running = false;

  // ----------------------------
  // NEW: Phase orchestration
  // ----------------------------
  private phase: DemoPhase = 'IDLE';

  constructor(
    private router: Router,
    private voiceSession: VoiceSessionService,
    private tts: TtsService
  ) {}

  // ✅ Avatar calls THIS now
  async handleAvatarClick(): Promise<void> {
    if (this.phase === 'IDLE') {
      await this.startProducts();
      return;
    }

    if (this.phase === 'WAITING_OPPORTUNITY_CLICK') {
      await this.startOpportunity();
      return;
    }

    // Ignore clicks during active speaking/running phases
    console.log('ℹ️ Avatar click ignored (phase):', this.phase);
  }

  // ----------------------------
  // PRODUCTS (mostly your original start())
  // ----------------------------
  private async startProducts() {
    if (this.running) return;

    this.phase = 'RUNNING_PRODUCTS';
    this.running = true;

    console.log('🚗 Driving demo started');

    await this.router.navigateByUrl('/store/c');
    this.voiceSession.setActive('products');

    this.index = 0;
    await this.runNext(); // <-- your existing recursion
  }

  private async runNext() {
    // 🔥 CHANGED: When products finished -> handoff cleanly
    if (this.index >= this.steps.length) {
      console.log('✅ Driving demo completed (products)');
      this.running = false;

      await this.handoffToOpportunity();  // ✅ NEW
      return;
    }

    const text = this.steps[this.index++];
    console.log('🚗 Driver:', text);

    // 🎙️ DRIVER VOICE (male, confident, slower)
    this.tts.speakWithVoice(
      text,
      'Google UK English Male',
      {
        rate: 0.92,
        pitch: 1.2
      }
    );

    // wait until driver finishes speaking
    await this.waitUntilTtsIdle();

    // inject utterance into system (NO MIC)
    this.voiceSession.injectFinal(text);

    // wait until product page finishes its TTS
    await this.waitForProductResponse();

    // natural pause between turns
    await this.sleep(1200);

    await this.runNext();
  }

  private waitForProductResponse(): Promise<void> {
    return new Promise(resolve => {
      const handler = () => {
        document.removeEventListener('products-response-complete', handler);
        resolve();
      };
      document.addEventListener('products-response-complete', handler);
    });
  }

  private async waitUntilTtsIdle(): Promise<void> {
    while (this.tts.isSpeaking() || this.tts.isPending()) {
      await this.sleep(120);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(res => setTimeout(res, ms));
  }

  // ----------------------------
  // NEW: Clean handoff to opportunity
  // ----------------------------
  private async handoffToOpportunity(): Promise<void> {
    this.phase = 'HANDOFF_TO_OPPORTUNITY';

    // Ensure product is truly done speaking
    await this.waitUntilTtsIdle();

    // Driver speaks transition line
    await this.tts.speakWithVoice(
      `Let’s create an opportunity.`,
      'Google UK English Male',
      { rate: 0.92, pitch: 1.2 }
    );

    // HARD STOP product ownership (no leakage)
    this.voiceSession.setActive(undefined);

    // Navigate to opportunity page
    await this.router.navigateByUrl('/crm/opportunities/create');

    // Now WAIT for user click, do NOT start voice automatically
    this.phase = 'WAITING_OPPORTUNITY_CLICK';

    // Optional: let page know we’re in demo-wait mode (if you want UI text)
    document.dispatchEvent(new CustomEvent('opportunity-demo-waiting'));
  }

  // ----------------------------
  // NEW: Opportunity start (on second click)
  // ----------------------------
  private async startOpportunity(): Promise<void> {
    this.phase = 'RUNNING_OPPORTUNITY';

    // Tell opportunity page: "register voice context + start"
    document.dispatchEvent(new CustomEvent('opportunity-demo-start'));

    // From here, opportunity page / context owns the flow.
    // DemoDriveService does not inject opportunity steps yet.
    // This keeps opportunity clean and independent.

    console.log('🧾 Opportunity demo started (ownership transferred)');

    // If you want DemoDriveService to ALSO drive scripted opportunity steps later,
    // we can add that as a separate service without touching product.
  }
}