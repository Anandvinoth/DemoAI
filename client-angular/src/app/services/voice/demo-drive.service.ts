// demo-drive.service.ts
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { VoiceSessionService } from './voice-session.service';
import { TtsService } from '../tts.service';

@Injectable({ providedIn: 'root' })
export class DemoDriveService {

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

  private index = 0;
  private running = false;

  constructor(
    private router: Router,
    private voiceSession: VoiceSessionService,
    private tts: TtsService
  ) {}

  async start() {
    if (this.running) return;
    this.running = true;

    console.log('🚗 Driving demo started');

    await this.router.navigateByUrl('/store/c');
    this.voiceSession.setActive('products');

    this.index = 0;
    await this.runNext();
  }

  private async runNext() {
    if (this.index >= this.steps.length) {
      console.log('✅ Driving demo completed');
      this.running = false;
      return;
    }

    const text = this.steps[this.index++];
    console.log('🚗 Driver:', text);

    // 🎙️ DRIVER VOICE (male, confident, slower)
    this.tts.speakWithVoice(
      text,
      'Google UK English Male',
      //'Google 日本語',
      {
        rate: 0.92,   // calm, confident
        // pitch: 0.9
        //rate: 1.0,     // recommended: 0.9–1.1
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
}
