import { Component, OnInit } from '@angular/core';
import { Header } from './components/header/header';
import { RouterOutlet } from '@angular/router';
import { Footer } from './components/footer/footer';
import { VoiceOrderService } from './services/voice/voice-order.service';
import { OrderTtsService } from './services/voice/order-tts.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [Header, Footer, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class AppComponent implements OnInit {
  constructor(
    private voiceOrder: VoiceOrderService,
    private orderTts: OrderTtsService
  ) {}

  ngOnInit(): void {
    console.log('🎧 Initializing voice order service...');
    this.voiceOrder.init();  // ✅ starts the voice-to-NLP-to-order pipeline
  }
}
