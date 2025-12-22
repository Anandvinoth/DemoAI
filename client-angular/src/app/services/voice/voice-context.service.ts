// src/app/services/voice/voice-context.service.ts
import { Injectable, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class VoiceContextService {

  private voiceMode$ = new BehaviorSubject<boolean>(false);
  mode = signal<'products' | 'orders' | 'opportunity' |'other'>('other');

  enable() {
    this.voiceMode$.next(true);
  }

  disable() {
    this.voiceMode$.next(false);
  }

  isVoiceMode(): boolean {
    return this.voiceMode$.value;
  }

  setMode(m: 'products' | 'orders' | 'other' | 'opportunity') {
    console.log("🎛️ Switching voice mode →", m);
    this.mode.set(m);
  }

  getMode() {
    return this.mode();
  }
  
  isOrders(): boolean {
    return this.mode() === 'orders';
  }

  isProducts(): boolean {
    return this.mode() === 'products';
  }
}

