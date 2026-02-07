// src/app/pages/assistant/assistant.page.ts
import { Component } from '@angular/core';
import { DemoDriveService } from '../../services/voice/demo-drive.service';
import { TtsService } from '../../services/tts.service';
import { AvatarComponent } from '../../avatar/avatar.component';

@Component({
  standalone: true,
//   imports: [AvatarComponent],
  template: '<div class="assistant-stage"></div>'
})
export class AssistantPage {

  constructor(
  ) {}
}
