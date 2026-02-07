import { Component, ChangeDetectionStrategy, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LottieComponent } from 'ngx-lottie';
import { AnimationOptions } from 'ngx-lottie';
import { Observable, merge, map, startWith } from 'rxjs';
import { fromEvent } from 'rxjs';
import { DemoDriveService } from '..//services/voice/demo-drive.service';
import { TtsService } from '../services/tts.service';
import { VoiceSessionService } from '../services/voice/voice-session.service';

type AvatarState = 'idle' | 'speaking' | 'listening';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule, LottieComponent],
  templateUrl: './avatar.component.html',
  styleUrls: ['./avatar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AvatarComponent {

  // private started = false;

  readonly state$: Observable<AvatarState>;
  @Output() startDemo = new EventEmitter<void>();

  readonly drivingOptions: AnimationOptions = {
    path: 'assets/avatar/driving.json',
    loop: true,
    autoplay: true
  };

  constructor(voiceSession: VoiceSessionService,
    private demo: DemoDriveService,
    private tts: TtsService
  ) {

    const speaking$ = merge(
      fromEvent(document, 'tts-started').pipe(map(() => true)),
      fromEvent(document, 'tts-ended').pipe(map(() => false))
    ).pipe(startWith(false));

    const listening$ = voiceSession.isListening$;

    this.state$ = merge(
      speaking$.pipe(map(s => s ? 'speaking' : 'idle')),
      listening$.pipe(map(l => l ? 'listening' : 'idle'))
    ).pipe(startWith<AvatarState>('idle'));
  }
  
  // onAvatarClick() {
    // this.startDemo.emit();
  // }
  async onAvatarClick() {
    // if (this.started) return;
    // this.started = true;

    console.log('🧑‍✈️ Avatar clicked — starting demo');

    // MUST be inside user gesture
    this.tts.unlock();

    // await this.demo.start();
    await this.demo.handleAvatarClick();
  }
}

