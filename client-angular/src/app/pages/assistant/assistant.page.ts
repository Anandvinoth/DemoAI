// src/app/pages/assistant/assistant.page.ts
import { Component } from '@angular/core';
import { DemoDriveService } from '../../services/voice/demo-drive.service';
import { TtsService } from '../../services/tts.service';

@Component({
  standalone: true,
  template: '<div class="assistant-stage"></div>'
})
export class AssistantPage {

  constructor(
  ) {}
}
