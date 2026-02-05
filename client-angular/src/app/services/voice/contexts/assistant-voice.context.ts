// assistant-voice.context.ts
import { Router } from '@angular/router';
import { VoiceContext } from '../voice-context';
import { VoiceSessionService } from '../voice-session.service';
import { TtsService } from '../../tts.service';

type AssistantState =
  | 'idle'
  | 'awaiting_intent'
  | 'handoff_products'
  | 'handoff_orders'
  | 'handoff_opportunity';

export class AssistantVoiceContext implements VoiceContext {

  readonly id = 'assistant';
  readonly wantsListening = false;

  private destroyed = false;
  private state: AssistantState = 'idle';

  // 🔒 Echo / turn control
  private lastAssistantUtterance = '';
  private assistantSpeaking = false;

  private mode: 'assistant-led' | 'driver-led' = 'assistant-led';

  constructor(
    private voiceSession: VoiceSessionService,
    private tts: TtsService,
    private router: Router
  ) {}

  /* ---------------- ACTIVATE ---------------- */

  onActivate(): void {
    this.destroyed = false;
    this.state = 'idle';

    // 🗣️ Assistant speaks FIRST
    this.speak(
      'I am driving with you. I can help with product search, order history, or creating an opportunity.'
    );
  }


  onDeactivate(): void {
    this.destroyed = true;
  }

  /* ---------------- MAIN DRIVER INPUT ---------------- */

  onFinal(text: string): void {
    if (this.destroyed) return;

    // 🚫 Ignore ALL driver speech when assistant is acting
    if (this.mode === 'assistant-led') {
      console.log('🧠 Assistant-led mode: ignoring driver input');
      return;
    }

    const value = text.toLowerCase().trim();

    // 🚫 Ignore assistant echo
    if (this.assistantSpeaking && this.isEcho(value)) {
      console.log('🔇 Ignored assistant TTS echo:', value);
      return;
    }

    console.log('🗣️ Driver said:', value);

    switch (this.state) {
      case 'idle':
        this.handleInitialIntent(value);
        return;

      case 'awaiting_intent':
        this.handleConfirmedIntent(value);
        return;
    }
  }

  /* ---------------- INTENT HANDLING ---------------- */

  private handleInitialIntent(text: string): void {
    if (this.isProductsIntent(text)) {
      this.confirm('product search', 'handoff_products');
      return;
    }

    if (this.isOrdersIntent(text)) {
      this.confirm('order history', 'handoff_orders');
      return;
    }

    if (this.isOpportunityIntent(text)) {
      this.confirm('creating an opportunity', 'handoff_opportunity');
      return;
    }

    this.askAgain();
  }

  private handleConfirmedIntent(text: string): void {
    if (this.isAffirmative(text)) {
      this.handoff();
      return;
    }

    if (this.isNegative(text)) {
      this.state = 'idle';
      this.askAgain();
      return;
    }

    // Still waiting for clear confirmation
    this.armMic();
  }

  /* ---------------- SPEECH (ASSISTANT VOICE) ---------------- */

  private speak(text: string): void {
    this.lastAssistantUtterance = text.toLowerCase();
    this.assistantSpeaking = true;

    // 🎙️ Assistant voice profile (distinct from system)
    this.tts.speak(text, {
      rate: 0.95,
      pitch: 1.15,
      lang: 'en-US'
    });

    // Allow mic only AFTER assistant finishes
    setTimeout(() => {
      this.assistantSpeaking = false;
      if (!this.destroyed) {
        this.armMic();
      }
    }, 900);
  }

  private confirm(label: string, next: AssistantState): void {
    this.state = next;
    this.speak(`I can help with ${label}. Should I continue?`);
  }

  private askAgain(): void {
    this.state = 'idle';
    this.speak(
      'I can help with product search, order history, or creating an opportunity. What would you like to do?'
    );
  }

  /* ---------------- HANDOFF ---------------- */

  private handoff(): void {
    switch (this.state) {
      case 'handoff_products':
        this.navigate('/store/c', 'products');
        break;

      case 'handoff_orders':
        this.navigate('/orders', 'orders');
        break;

      case 'handoff_opportunity':
        this.navigate('/crm/opportunities/create', 'opportunity-create');
        break;
    }
  }

  private navigate(url: string, ctx: string): void {
    this.speak('Okay.');
    this.router.navigateByUrl(url).then(() => {
      this.voiceSession.setActive(ctx);
    });
  }

  /* ---------------- MIC CONTROL ---------------- */

  private armMic(): void {
    this.voiceSession.requestListening({
      language: 'en-US',
      continuous: false
    });
  }

  /* ---------------- HELPERS ---------------- */

  private isEcho(text: string): boolean {
  if (!this.lastAssistantUtterance) return false;

  return (
    text === this.lastAssistantUtterance ||
    this.lastAssistantUtterance.includes(text)
  );
}

  private isAffirmative(t: string): boolean {
    return ['yes', 'yeah', 'correct', 'go ahead', 'sure', 'continue'].includes(t);
  }

  private isNegative(t: string): boolean {
    return ['no', 'cancel', 'stop', 'not now'].includes(t);
  }

  private isProductsIntent(t: string): boolean {
    return t.includes('product');
  }

  private isOrdersIntent(t: string): boolean {
    return t.includes('order');
  }

  private isOpportunityIntent(t: string): boolean {
    return t.includes('opportunity');
  }
}
