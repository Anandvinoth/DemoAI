// Minimal Web Speech API typings just for what we use

declare class SpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: (ev: SpeechRecognitionEvent) => any;
  onerror: (ev: any) => any;
  onend: (ev: Event) => any;
  start(): void;
  stop(): void;
}

declare interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  0: SpeechRecognitionAlternative;
  length: number;
}

declare interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

declare interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

declare var SpeechRecognition: { new (): SpeechRecognition };
declare var webkitSpeechRecognition: { new (): SpeechRecognition };
