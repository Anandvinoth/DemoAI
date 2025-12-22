// src/app/services/voice/voice-opportunity.service.ts
import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { TtsService } from '../tts.service';
import { Router } from '@angular/router';

type OpportunityField =
  | 'opportunity_name'
  | 'account_id'
  | 'primary_contact_id'
  | 'owner_id'
  | 'stage'
  | 'status'
  | 'amount'
  | 'currency'
  | 'probability'
  | 'expected_revenue';

interface OpportunityStep {
  field: OpportunityField;
  prompt: string;
  type: 'code' | 'account' | 'contact' | 'dropdown' | 'number' | 'text';
  options?: string[];
  validate?: (value: string) => string | null;
}

interface AutocompleteResponse {
  query: string;
  accounts: [string, string][];
  contacts: [string, string][];
}

interface ChoiceItem {
  id: string;
  label: string;
}

const STAGE_OPTIONS: string[] = [
  'Prospecting',
  'Qualification',
  'Needs Analysis',
  'Value Proposition',
  'Proposal/Price Quote',
  'Negotiation/Review',
  'Closed Won',
  'Closed Lost'
];

const STATUS_OPTIONS: string[] = ['Open', 'Working', 'Closed'];
const CURRENCY_OPTIONS: string[] = ['USD', 'CAD'];

@Injectable({ providedIn: 'root' })
export class VoiceOpportunityService {
  // overall state
  inGuidedMode = signal(false);
  currentIndex = signal(0);

  readonly steps: OpportunityStep[];

  onFieldCaptured?: (field: string, value: string) => void;

  // 🔥 Pending option selection support
  private pendingOptionPrefix = false;
  private accountChoices: ChoiceItem[] = [];
  private contactChoices: ChoiceItem[] = [];
  private currentOptions: string[] = [];
  private currentField!: OpportunityField;
  private awaitingChoiceSelection = false;
  private awaitingOptionNumber = false;
  private currentAutocompleteField: 'account_id' | 'primary_contact_id' | null = null;

  private isEditingNumber = false;

  constructor(
    private tts: TtsService,
    private http: HttpClient,
    private router: Router
  ) {
    this.steps = [
      {
        field: 'opportunity_name',
        prompt: 'What is the opportunity name?',
        type: 'code',
        validate: this.validateOpportunityNameText
      },
      { field: 'account_id', prompt: 'What is the account ID or account name?', type: 'account' },
      { field: 'primary_contact_id', prompt: 'Who is the primary contact?', type: 'contact' },
      { field: 'owner_id', prompt: 'Who owns this opportunity?', type: 'code' },
      { field: 'stage', prompt: 'What is the stage?', type: 'dropdown', options: STAGE_OPTIONS },
      { field: 'status', prompt: 'What is the status?', type: 'dropdown', options: STATUS_OPTIONS },
      { field: 'amount', prompt: 'What is the amount?', type: 'number', validate: this.validateAmount },
      { field: 'currency', prompt: 'What is the currency?', type: 'dropdown', options: CURRENCY_OPTIONS },
      { field: 'probability', prompt: 'What is the probability percentage?', type: 'number' },
      { field: 'expected_revenue', prompt: 'What is the expected revenue?', type: 'number' }
    ];
  }

  private isOnCreatePage(): boolean {
    return this.router.url.includes('/crm/opportunities/create');
  }

  // ------------------------------------------------------------------
  // PUBLIC API
  // ------------------------------------------------------------------

  startGuidedFlow(): void {
    console.log('🎯 Opportunity guided flow started.');
    this.inGuidedMode.set(true);
    this.currentIndex.set(0);
    this.accountChoices = [];
    this.contactChoices = [];
    this.awaitingChoiceSelection = false;
    this.currentAutocompleteField = null;
    this.isEditingNumber = false;

    this.tts.speakWhenIdle('Sure. Let us create a new opportunity.');
    this.askCurrentStep();
  }
    
  process(raw: string): void {
      console.log("voiceOpportunityService Process method entered.......");
      const u = raw.toLowerCase().trim();

      // Step 1: Option prefix
      if (u === 'option') {
        this.awaitingOptionNumber = true;
        console.log('🟡 Option prefix received — awaiting number');
        return; // 👈 DO NOT CONSUME PIPELINE
      }

      // Step 2: Option continuation
//      if (this.awaitingOptionNumber) {
//        const matched = this.matchDropdownOption(this.currentOptions, u);
//        if (matched) {
//          this.awaitingOptionNumber = false;
//          this.setField(this.currentField, matched);
//          return; // 👈 SUCCESSFULLY CONSUMED
//        }
//
//        console.log('🟠 Still waiting for valid option number');
//        return; // 👈 KEEP MIC ALIVE
//      }
        if (this.awaitingOptionNumber) {
            const step = this.steps[this.currentIndex()];
            if (step.type === 'dropdown' && step.options?.length) {
              const match = this.matchDropdownOption(step.options, raw);
              if (match) {
                this.awaitingOptionNumber = false;
                this.setField(step.field, match);
                this.nextStep();
                return;
              }
         }
         console.log('🟠 Still waiting for valid option number');
         return;
         }

      // normal guided handling continues...
         this.captureAnswer(raw);
  }

//  isAwaitingFollowup(): boolean {
//    return this.awaitingOptionNumber;
//  }

//  isBlocking(): boolean {
//      return this.awaitingOptionNumber === true;
//  }

//  process(text: string): void {
//    if (!this.inGuidedMode()) return;
//
//    // 🔥 HARD GUARD: if user left create page manually, stop everything
//    if (!this.isOnCreatePage()) {
//      console.log('🛑 Opportunity voice ignored — not on create page');
//      this.hardStop('Left opportunity create page');
//      return;
//    }
//
//    const u = text.trim().toLowerCase();
//    console.log('🎧 Opportunity.process():', text);
//
//    if (this.handleGlobalCommands(u)) return;
//    
//    // 🔥 Ignore STT noise like "option"
//    if (this.isNoiseToken(u)) {
//      console.log('🟡 Option prefix received — awaiting number');
//      this.pendingOptionPrefix = true;
//      return; // 👈 STILL CONSUMED
//    }
//
//    this.captureAnswer(text);
//    return;
//  }
  
//  private isNoiseToken(u: string): boolean {
//    return u === 'option' || u === 'options';
//  }

  // ------------------------------------------------------------------
  // GLOBAL COMMANDS
  // ------------------------------------------------------------------

  private handleGlobalCommands(u: string): boolean {
    if (u === 'stop opportunity') {
      this.stopFlow('Okay, stopping opportunity creation.');
      return true;
    }
    if (u === 'repeat') {
      this.askCurrentStep();
      return true;
    }
    if (u === 'back' || u === 'go back' || u === 'previous') {
      this.goBack();
      return true;
    }
    if (u === 'review') {
      this.reviewFlow();
      return true;
    }
    if (u === 'submit opportunity') {
      this.finishAndSubmit();
      return true;
    }

    const editMatch = u.match(/^(edit|change|update)\s+(.+)/);
    if (editMatch) {
      const fieldPhrase = editMatch[2].trim();
      const targetField = this.mapFieldFromPhrase(fieldPhrase);
      if (!targetField) {
        this.tts.speakWhenIdle(
          'I could not find that field. You can say edit opportunity name, edit account, edit stage, edit status, edit amount, edit probability or edit currency.'
        );
      } else {
        this.jumpToField(targetField);
      }
      return true;
    }
    return false;
  }

  private mapFieldFromPhrase(phrase: string): OpportunityField | null {
    const p = phrase.toLowerCase();
    if (p.includes('opportunity') && p.includes('name')) return 'opportunity_name';
    if (p.includes('name') && !p.includes('account') && !p.includes('contact')) return 'opportunity_name';
    if (p.includes('account')) return 'account_id';
    if (p.includes('contact')) return 'primary_contact_id';
    if (p.includes('owner')) return 'owner_id';
    if (p.includes('stage')) return 'stage';
    if (p.includes('status')) return 'status';
    if (p.includes('amount')) return 'amount';
    if (p.includes('currency')) return 'currency';
    if (p.includes('probability') || p.includes('percent')) return 'probability';
    if (p.includes('expected') && p.includes('revenue')) return 'expected_revenue';
    return null;
  }

  private jumpToField(field: OpportunityField): void {
    const idx = this.steps.findIndex(s => s.field === field);
    if (idx === -1) {
      this.tts.speakWhenIdle('I could not find that field in the form.');
      return;
    }

    this.currentIndex.set(idx);

    this.accountChoices = [];
    this.contactChoices = [];
    this.awaitingChoiceSelection = false;
    this.currentAutocompleteField = null;

    const step = this.steps[idx];
    this.isEditingNumber = (step.type === 'number');

    const label = this.prettyFieldName(field);
    this.tts.speakWhenIdle(`Okay, let us update ${label}.`);

    if (step.type === 'dropdown' && step.options?.length) {
      const preview = step.options.slice(0, 4).join(', ');
      this.tts.speakWhenIdle(
        `${step.prompt} For example: ${preview}. You can say option number or the option name.`
      );
      return;
    }

    this.askCurrentStep();
  }

  // ------------------------------------------------------------------
  // CAPTURE ANSWER
  // ------------------------------------------------------------------

  private captureAnswer(text: string): void {
    const step = this.steps[this.currentIndex()];
    const raw = text.trim();
    if (!raw) {
      this.tts.speakWhenIdle('I did not catch anything. Please say it again.');
      return;
    }

    switch (step.type) {
      case 'code': this.handleCodeStep(step, raw); break;
      case 'account': this.handleAccountStep(step, raw); break;
      case 'contact': this.handleContactStep(step, raw); break;
      case 'dropdown': this.handleDropdownStep(step, raw); break;
      case 'number': this.handleNumberStep(step, raw); break;
      default: this.handleTextStep(step, raw); break;
    }
  }

  // ------------------------------------------------------------------
  // STEP HANDLERS
  // ------------------------------------------------------------------

  private handleCodeStep(step: OpportunityStep, raw: string): void {
    const normalized = this.normalizeCode(raw);

    if (step.validate) {
      const error = step.validate(normalized);
      if (error) {
        this.tts.speakWhenIdle(error + ' Please say it again.');
        return;
      }
    }

    this.setField(step.field, normalized);
    const label = this.prettyFieldName(step.field);

    const isCode = /^[A-Z]{2,5}\d{1,6}$/.test(normalized);
    const spoken = isCode ? this.spellForTts(normalized) : normalized;

    this.tts.speakWhenIdle(`Got it. ${label} is ${spoken}.`);
    this.nextStep();
  }

  private handleAccountStep(step: OpportunityStep, raw: string): void {
    if (this.awaitingChoiceSelection && this.currentAutocompleteField === 'account_id') {
      const choice = this.pickChoice(raw, this.accountChoices);
      if (!choice) {
        this.tts.speakWhenIdle('Please say the option number, or the account name or ID.');
        return;
      }
      this.setField('account_id', choice.id);
      this.tts.speakWhenIdle('Account selected.');
      this.resetAutocompleteState();
      this.nextStep();
      return;
    }

    this.currentAutocompleteField = 'account_id';
    const params = new HttpParams().set('q', raw);

    this.http
      .get<AutocompleteResponse>('http://localhost:8000/api/opportunities/search', { params })
      .subscribe({
        next: res => {
          this.accountChoices = (res.accounts || []).map(a => ({ id: a[0], label: a[1] }));

          if (!this.accountChoices.length) {
            this.tts.speakWhenIdle('No account found. Please say the account ID or name again.');
            return;
          }

          if (this.accountChoices.length === 1) {
            const only = this.accountChoices[0];
            console.log('✅ Single account auto-selected:', only);
            this.setField('account_id', only.id);
            this.resetAutocompleteState();
            this.nextStep();
            return;
          }

          const top = this.accountChoices.slice(0, 5);
          let msg = top.map((c, i) => `Option ${i + 1}: ${c.id}, ${c.label}`).join('. ');
          msg += '. Please say an option number, or say the account name or ID.';
          this.awaitingChoiceSelection = true;
          this.tts.speakWhenIdle(msg);
        },
        error: err => {
          console.error('Account autocomplete failed:', err);
          this.tts.speakWhenIdle('Account search failed. Please try again.');
        }
      });
  }

  private resetAutocompleteState(): void {
    this.awaitingChoiceSelection = false;
    this.pendingOptionPrefix = false;
    this.currentAutocompleteField = null;
    this.accountChoices = [];
    this.contactChoices = [];
  }

  private handleContactStep(step: OpportunityStep, raw: string): void {
    if (this.awaitingChoiceSelection && this.currentAutocompleteField === 'primary_contact_id') {
      const choice = this.pickChoice(raw, this.contactChoices);
      if (!choice) {
        this.tts.speakWhenIdle(
          'I did not quite catch that. Please say the option number, or the contact name or ID.'
        );
        return;
      }

      this.setField('primary_contact_id', choice.id);
      this.tts.speakWhenIdle(`Okay. Primary contact is ${choice.id}, ${choice.label}.`);
      this.resetAutocompleteState();
      this.nextStep();
      return;
    }

    this.currentAutocompleteField = 'primary_contact_id';
    const params = new HttpParams().set('q', raw);

    this.http
      .get<AutocompleteResponse>('http://localhost:8000/api/opportunities/search', { params })
      .subscribe({
        next: res => {
          this.contactChoices = (res.contacts || []).map(c => ({ id: c[0], label: c[1] }));
          if (!this.contactChoices.length) {
            this.tts.speakWhenIdle('I could not find any contacts for that. Please say the contact name or ID again.');
            return;
          }

          const top = this.contactChoices.slice(0, 5);
          let msg = `I found ${this.contactChoices.length} contacts. `;
          msg += top.map((c, i) => `Option ${i + 1}: ${c.id}, ${c.label}`).join('. ');
          msg += '. Please say an option number, like option 1, or say the contact name or ID.';

          this.awaitingChoiceSelection = true;
          this.tts.speakWhenIdle(msg);
        },
        error: err => {
          console.error('Contact autocomplete failed:', err);
          this.tts.speakWhenIdle('I had trouble searching contacts. Please say the contact again.');
        }
      });
  }

  private handleDropdownStep(step: OpportunityStep, raw: string): void {
    if (!step.options || !step.options.length) {
      this.setField(step.field, raw);
      this.nextStep();
      return;
    }

    const cleaned = raw.trim().toLowerCase();
    if (cleaned === 'option' || cleaned === 'options') {
      this.tts.speakWhenIdle(
        'I heard option. Please say the option number, like option one or option two, or say the option name.'
      );
      return;
    }

    const match = this.matchDropdownOption(step.options, raw);
    if (!match) {
      const label = this.prettyFieldName(step.field);
      const short = step.options.slice(0, 6).join(', ');
      this.tts.speakWhenIdle(
        `I did not quite catch that. Please say a valid option for ${label}, like a number or the option name. Some options are: ${short}.`
      );
      return;
    }

    this.setField(step.field, match);
    const label = this.prettyFieldName(step.field);
    this.tts.speakWhenIdle(`Got it. ${label} is ${match}.`);
    this.nextStep();
  }

  private handleNumberStep(step: OpportunityStep, raw: string): void {
    const clean = raw.trim().toLowerCase();

    if (this.isEditingNumber) {
      const validNumberLike =
        /^([\d.,]+|\d+(\.\d+)?\s*(k|thousand|million)|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)$/;
      if (!validNumberLike.test(clean)) {
        this.tts.speakWhenIdle(
          'Please provide only a numeric value. For example: 5000, 50 thousand, 50 k, or a number like seven.'
        );
        return;
      }
    }

    const parsed = this.parseSpokenNumber(raw);

    if (parsed === 0 && !clean.includes('0') && !clean.includes('zero')) {
      this.tts.speakWhenIdle('I did not understand that number. Please say it again clearly.');
      return;
    }

    if (step.validate) {
      const err = step.validate(String(parsed));
      if (err) {
        this.tts.speakWhenIdle(err + ' Please say it again.');
        return;
      }
    }

    this.setField(step.field, String(parsed));
    const label = this.prettyFieldName(step.field);
    this.tts.speakWhenIdle(`Got it. ${label} is ${parsed}.`);

    this.isEditingNumber = false;
    this.nextStep();
  }

  private handleTextStep(step: OpportunityStep, raw: string): void {
    const clean = this.normalizeOpportunityName(raw);

    if (step.validate) {
      const error = step.validate(clean);
      if (error) {
        this.tts.speakWhenIdle(error + ' Please say it again.');
        return;
      }
    }

    this.setField(step.field, clean);
    const label = this.prettyFieldName(step.field);
    this.tts.speakWhenIdle(`Got it. ${label} is ${clean}.`);
    this.nextStep();
  }

  // ------------------------------------------------------------------
  // FLOW NAVIGATION
  // ------------------------------------------------------------------

  private askCurrentStep(): void {
    const step = this.steps[this.currentIndex()];
    if (step.type === 'dropdown' && step.options?.length) {
      const preview = step.options.slice(0, 4).join(', ');
      this.tts.speakWhenIdle(
        `${step.prompt} For example: ${preview}. You can say option number or the option name.`
      );
    } else {
      this.tts.speakWhenIdle(step.prompt);
    }
  }

  private nextStep(): void {
    if (this.currentIndex() + 1 < this.steps.length) {
      this.currentIndex.set(this.currentIndex() + 1);
      this.resetAutocompleteState();
      this.askCurrentStep();
    } else {
      this.tts.speakWhenIdle(
        'I have collected all required fields. You can say review to hear a summary, or say submit opportunity.'
      );
    }
  }

  private goBack(): void {
    if (this.currentIndex() === 0) {
      this.tts.speakWhenIdle('You are already at the first field.');
      return;
    }
    this.currentIndex.set(this.currentIndex() - 1);
    this.resetAutocompleteState();
    this.askCurrentStep();
  }

  private reviewFlow(): void {
    this.tts.speakWhenIdle(
      'Here is a quick review of the opportunity. You can say edit opportunity name, edit account, edit stage, edit probability, or say submit opportunity when you are happy.'
    );
  }

  private finishAndSubmit(): void {
    this.tts.speakWhenIdle('Submitting the opportunity.');
    this.onFieldCaptured?.('__submit__' as any, '');
  }

  private stopFlow(reason: string): void {
    this.tts.speakWhenIdle(reason);
    this.inGuidedMode.set(false);
    this.resetAutocompleteState();
    this.isEditingNumber = false;
  }

  // ------------------------------------------------------------------
  // HELPERS
  // ------------------------------------------------------------------

  private setField(field: OpportunityField, value: string): void {
    console.log('📝 [VoiceOpp] setField', field, value);
    this.onFieldCaptured?.(field, value);
  }

  private prettyFieldName(field: string): string {
    switch (field) {
      case 'opportunity_name': return 'opportunity name';
      case 'account_id': return 'account';
      case 'primary_contact_id': return 'primary contact';
      case 'owner_id': return 'owner';
      case 'stage': return 'stage';
      case 'status': return 'status';
      case 'amount': return 'amount';
      case 'currency': return 'currency';
      case 'probability': return 'probability';
      case 'expected_revenue': return 'expected revenue';
      default: return field.replace(/_/g, ' ');
    }
  }

  private normalizeCode(raw: string): string {
    let v = raw.trim();
    const hasNumber = /\d/.test(v);
    const short = v.replace(/\s+/g, '').length <= 10;
    if (hasNumber && short) return v.replace(/\s+/g, '').toUpperCase();
    return this.toTitleCase(v);
  }

  private toTitleCase(text: string): string {
    return text
      .toLowerCase()
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.substring(1))
      .join(' ');
  }

  private spellForTts(code: string): string {
    return code.split('').join(' ');
  }

  private parseSpokenNumber(raw: string): number {
    const u = raw.toLowerCase().trim();

    if (u.includes('half million')) return 500000;
    if (u.includes('quarter million')) return 250000;

    const millionMatch = u.match(/(\d+(\.\d+)?)\s*million/);
    if (millionMatch) return Number(millionMatch[1]) * 1_000_000;

    const thousandMatch = u.match(/(\d+(\.\d+)?)\s*(k|thousand)/);
    if (thousandMatch) return Number(thousandMatch[1]) * 1_000;

    const digitWords: Record<string, string> = {
      zero: '0', one: '1', two: '2', three: '3', four: '4',
      five: '5', six: '6', seven: '7', eight: '8', nine: '9'
    };

    if (u.split(' ').every(w => digitWords[w])) {
      return Number(u.split(' ').map(w => digitWords[w]).join(''));
    }

    const n = Number(u.replace(/[^0-9.]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  private matchDropdownOption(options: string[], raw: string): string | null {
      const u = raw.toLowerCase().trim();

      // --------------------------------------------------
      // 🔥 Case 0: user said ONLY "option" → wait for number
      // --------------------------------------------------
      if (u === 'option' || u === 'options') {
        console.log('🟡 Dropdown option prefix received — awaiting number');
        this.pendingOptionPrefix = true;
        return null; // 👈 consumed, do NOT fall through
      }

      // --------------------------------------------------
      // 🔥 Case 1: STT split case → "option" then "two"
      // --------------------------------------------------
      if (this.pendingOptionPrefix) {
        const numMap: Record<string, number> = {
          one: 1, won: 1, first: 1, '1': 1,
          two: 2, to: 2, too: 2, second: 2, '2': 2,
          three: 3, tree: 3, third: 3, '3': 3,
          four: 4, for: 4, fourth: 4, '4': 4,
          five: 5, fifth: 5, '5': 5
        };

        if (numMap[u] != null) {
          const idx = numMap[u] - 1;
          this.pendingOptionPrefix = false;

          if (idx >= 0 && idx < options.length) {
            return options[idx];
          }
        }

        // number not understood → reset prefix
        this.pendingOptionPrefix = false;
      }

      // --------------------------------------------------
      // 🔹 Case 2: "option two" / "option 2" (single utterance)
      // --------------------------------------------------
      const optionMatch = u.match(/option\s+(\w+|\d+)/);
      if (optionMatch) {
        const token = optionMatch[1];
        const idx = this.wordToIndex(token);
        if (idx !== null && idx < options.length) {
          return options[idx];
        }
      }

      // --------------------------------------------------
      // 🔹 Case 3: plain spoken number ("two", "2")
      // --------------------------------------------------
      const directIdx = this.wordToIndex(u);
      if (directIdx !== null && directIdx < options.length) {
        return options[directIdx];
      }

      // --------------------------------------------------
      // 🔹 Case 4: numeric token anywhere ("choose 2")
      // --------------------------------------------------
      const num = u.match(/\b(\d+)\b/);
      if (num) {
        const idx = parseInt(num[1], 10) - 1;
        if (idx >= 0 && idx < options.length) {
          return options[idx];
        }
      }

      // --------------------------------------------------
      // 🔹 Case 5: exact text match
      // --------------------------------------------------
      const exact = options.find(o => o.toLowerCase() === u);
      if (exact) return exact;

      // --------------------------------------------------
      // 🔹 Case 6: partial text match
      // --------------------------------------------------
      const partial = options.find(o => o.toLowerCase().includes(u));
      if (partial) return partial;

      return null;
    }

   private wordToIndex(token: string): number | null {
      const map: Record<string, number> = {
        one: 0, won: 0, first: 0, '1': 0,
        two: 1, to: 1, too: 1, second: 1, '2': 1,
        three: 2, tree: 2, third: 2, '3': 2,
        four: 3, for: 3, fourth: 3, '4': 3,
        five: 4, fifth: 4, '5': 4
      };

      return map[token] ?? null;
   }

  // Pick from autocomplete list by option number, id, or label
  private pickChoice(raw: string, choices: ChoiceItem[]): ChoiceItem | null {
      const u = raw.toLowerCase().trim();

      // 🔥 Case 1: user said only "option" → wait for number
      if (u === 'option' || u === 'options') {
        this.pendingOptionPrefix = true;
        return null;
      }

      // 🔥 Case 2: STT split → "option" then "two"
      if (this.pendingOptionPrefix) {
        const numMap: Record<string, number> = {
          one: 1,
          won: 1,
          first: 1,
          '1': 1,
          two: 2,
          to: 2,
          too: 2,
          second: 2,
          '2': 2,
          three: 3,
          tree: 3,
          third: 3,
          '3': 3,
          four: 4,
          for: 4,
          fourth: 4,
          '4': 4,
          five: 5,
          fifth: 5,
          '5': 5
        };

        if (numMap[u] != null) {
          const idx = numMap[u] - 1;
          this.pendingOptionPrefix = false;

          if (idx >= 0 && idx < choices.length) {
            return choices[idx];
          }
        }
      }

      // reset prefix if user said something else
      this.pendingOptionPrefix = false;

      // 🔹 Normal number-based selection
      const spokenNumbers: Record<string, number> = {
        one: 1,
        won: 1,
        first: 1,
        'option one': 1,
        'option 1': 1,
        '1': 1,
        two: 2,
        to: 2,
        too: 2,
        second: 2,
        'option two': 2,
        'option 2': 2,
        '2': 2,
        three: 3,
        tree: 3,
        third: 3,
        '3': 3,
        four: 4,
        for: 4,
        fourth: 4,
        '4': 4,
        five: 5,
        fifth: 5,
        '5': 5
      };

      if (spokenNumbers[u] != null) {
        const idx = spokenNumbers[u] - 1;
        if (idx >= 0 && idx < choices.length) {
          return choices[idx];
        }
      }

      // numeric token inside sentence
      const numMatch = u.match(/\b(\d+)\b/);
      if (numMatch) {
        const idx = parseInt(numMatch[1], 10) - 1;
        if (idx >= 0 && idx < choices.length) {
          return choices[idx];
        }
      }

      // match by ID
      const byId = choices.find(c => u.includes(c.id.toLowerCase()));
      if (byId) return byId;

      // match by label
      const byLabel = choices.find(c => c.label.toLowerCase().includes(u));
      if (byLabel) return byLabel;

      return null;
  }


  private normalizeOpportunityName(raw: string): string {
    let v = raw.trim();
    v = v
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    v = v.replace(/[.,!?]+$/g, '');
    return v;
  }

  private validateOpportunityNameText(value: string): string | null {
    if (value.length < 3) return 'Opportunity name is too short.';
    return null;
  }

  private validateAmount(value: string): string | null {
    const num = Number(value.replace(/[^0-9.-]/g, ''));
    if (isNaN(num) || num <= 0) return 'Amount must be a positive number.';
    return null;
  }

  // ------------------------------------------------------------------
  // HARD STOP (used when leaving page / safety)
  // ------------------------------------------------------------------
  hardStop(reason = 'Opportunity flow cancelled.') {
    console.log('🛑 Opportunity HARD STOP:', reason);

    this.inGuidedMode.set(false);
    this.currentIndex.set(0);

    this.accountChoices = [];
    this.contactChoices = [];
    this.awaitingChoiceSelection = false;
    this.currentAutocompleteField = null;
    this.isEditingNumber = false;

    // 🔥 stop speaking immediately
    this.tts.stop();
  }
}
