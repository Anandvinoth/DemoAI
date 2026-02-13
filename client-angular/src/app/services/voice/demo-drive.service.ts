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
    'Get me all the products',
    'show products under 50',
    'Brand 3M',
    'price less than 25',
    'price above 300',
    'price between 100 and 250',
    'Category Furniture',
    'Material Steel',
    'Color Red',
    'Category PowerTools',
    'Brand Kito',
    'Material Steel and Color Gray',
    'Get me all the products'
  ];

  private opportunitySteps = [
    { ask: 'What is the opportunity name?', answer: 'Marriott redesign' },
    { ask: 'What is the account id?', answer: 'ACC1014' },
    { ask: 'Who is the primary contact?', answer: 'Cody Stidham' },
    { ask: 'Who is the owner?', answer: 'Chris Post' },
    { ask: 'What is the expected amount?', answer: '500000' },
    { ask: 'What is the expected close date?', answer: 'March 31st 2026' }
  ];

    private opportunityIndex = 0;


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
     // `Let’s create an opportunity.`,
     'Do you want to create an opportunity?',
      'Google UK English Female',
      { rate: 0.92, pitch: 1.2 }
    );

    await this.waitUntilTtsIdle();
    // DEMO: assistant answers itself (audible)
    await this.tts.speakWithVoice(
      'Yes',
      'Google UK English Male',
      { rate: 0.92, pitch: 1.1 }
    );

    await this.waitUntilTtsIdle();

    // HARD STOP product ownership (no leakage)
    this.voiceSession.setActive(undefined);

    // Navigate to opportunity page
    await this.router.navigateByUrl('/crm/opportunities/create');

    // Now WAIT for user click, do NOT start voice automatically
    // this.phase = 'WAITING_OPPORTUNITY_CLICK';

    // Start opportunity flow immediately
    // document.dispatchEvent(new CustomEvent('opportunity-demo-start'));
    await new Promise(res => setTimeout(res, 0));
    await this.startOpportunityDemo();
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

  //OPPORTUNITY DEMO
    private async startOpportunityDemo(): Promise<void> {
    this.opportunityIndex = 0;
    await this.runNextOpportunityStep();
  }

  private async runNextOpportunityStep(): Promise<void> {
    if (this.opportunityIndex >= this.opportunitySteps.length) {
      // await this.tts.speakWithVoice(
      //   'The opportunity has been created successfully.',
      //   'Google UK English Female',
      //   { rate: 0.9, pitch: 1.1 }
      // );
      this.phase = 'DONE';
      return;
    }

    const step = this.opportunitySteps[this.opportunityIndex++];

    // 🗣️ SYSTEM ASKS (Female)
    await this.tts.speakWithVoice(
      step.ask,
      'Google UK English Female',
      { rate: 0.9, pitch: 1.1 }
    );

    await this.waitUntilTtsIdle();

    // 🧑‍✈️ DRIVER ANSWERS (Male, audible)
    await this.tts.speakWithVoice(
      step.answer,
      'Google UK English Male',
      { rate: 0.95, pitch: 1.0 }
    );

    await this.waitUntilTtsIdle();

    // 🧠 Deliver answer to opportunity context
    this.voiceSession.injectFinal(step.answer);

    await this.sleep(800);

    await this.runNextOpportunityStep();
  }
}