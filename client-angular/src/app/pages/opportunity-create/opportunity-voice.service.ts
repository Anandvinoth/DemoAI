// opportunity-voice.service.ts
import { Injectable } from '@angular/core';

/**
 * All possible guided flow states for Opportunity voice
 */
export enum OpportunityVoiceState {
  INIT = 'INIT',
  PROMPTING = 'PROMPTING',
  LISTENING = 'LISTENING',
  INTERPRETING = 'INTERPRETING',
  CONFIRMING = 'CONFIRMING',
  ADVANCING = 'ADVANCING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

/**
 * Types of input we expect from the user
 */
export enum ExpectedInputType {
  OPTION = 'OPTION',
  NUMBER = 'NUMBER',
  CURRENCY = 'CURRENCY',
  FREE_TEXT = 'FREE_TEXT',
  DATE = 'DATE',                 
  CONFIRM_YES_NO = 'CONFIRM_YES_NO'
}


/**
 * Definition of one guided field in Opportunity creation
 */
export interface OpportunityField {
  id: string;
  prompt: string;
  expectedInput: ExpectedInputType;
  options?: string[]; // used only when expectedInput = OPTION
}

@Injectable({ providedIn: 'root' })
export class OpportunityVoiceService {

  /** Current guided flow state */
  state: OpportunityVoiceState = OpportunityVoiceState.INIT;

  /** Index of current field being captured */
  private fieldIndex = 0;

  /** Buffer for partial / final STT text */
  private speechBuffer = '';

  /** Guided fields for Opportunity creation */
  private fields: OpportunityField[] = [
  {
    id: 'opportunity_name',
    prompt: 'What is the opportunity name?',
    expectedInput: ExpectedInputType.FREE_TEXT
  },
  {
    id: 'deal_type',
    prompt: 'Select deal type. Option one, New Business. Option two, Existing Business. Option three, Renewal. Option four, Upsell.',
    expectedInput: ExpectedInputType.OPTION,
    options: ['New Business', 'Existing Business', 'Renewal', 'Upsell']
  },
  {
    id: 'stage',
    prompt: 'Select stage. Option one, Prospecting. Option two, Qualification. Option three, Proposal.',
    expectedInput: ExpectedInputType.OPTION,
    options: ['Prospecting', 'Qualification', 'Proposal/Price Quote']
  },
  {
    id: 'amount',
    prompt: 'What is the deal amount?',
    expectedInput: ExpectedInputType.CURRENCY
  },
  {
    id: 'probability',
    prompt: 'What is the probability percentage?',
    expectedInput: ExpectedInputType.NUMBER
  },
  {
    id: 'expected_close_date',
    prompt: 'What is the expected close date?',
    expectedInput: ExpectedInputType.DATE
  }
];
    
  /** Stores final captured values */
  private values: Record<string, any> = {};

  /**
   * Reset everything when Opportunity voice starts fresh
   */
  reset(): void {
    this.state = OpportunityVoiceState.INIT;
    this.fieldIndex = 0;
    this.speechBuffer = '';
    this.values = {};
  }

  /**
   * Returns the current field definition
   */
  getCurrentField(): OpportunityField {
    return this.fields[this.fieldIndex];
  }

  /**
   * Called by component for every STT partial
   * We ONLY buffer, never decide here
   */
  onPartialResult(text: string): void {
    this.speechBuffer = text.toLowerCase();
  }

  /**
   * Called by component once STT final result arrives
   * This is the ONLY place where interpretation happens
   */
  interpretFinalResult(text: string): { valid: boolean; value?: any } {
    this.state = OpportunityVoiceState.INTERPRETING;

    const field = this.getCurrentField();
    const normalized = text.toLowerCase().trim();

    switch (field.expectedInput) {

      case ExpectedInputType.OPTION:
        return this.interpretOption(normalized, field);

      case ExpectedInputType.CURRENCY:
        return this.interpretCurrency(normalized);
                                       
      case ExpectedInputType.DATE:
        return this.interpretDate(normalized);

      default:
        return { valid: false };
    }
  }
  
  /**
 * Minimal date parsing:
 * Accepts ISO-like "2026-01-31" directly.
 * Otherwise returns invalid (we can improve later).
 */
  private interpretDate(text: string) {
      // Very safe v1: accept yyyy-mm-dd (matches <input type="date"> format)
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return { valid: true, value: text };
      }
      return { valid: false };
  }


  /**
   * Interprets option-style inputs (option one / one / 1)
   */
  private interpretOption(text: string, field: OpportunityField) {
    if (!field.options) return { valid: false };

    // Map spoken numbers to index
    const optionMap: Record<string, number> = {
      'one': 0,
      '1': 0,
      'two': 1,
      '2': 1
    };

    for (const key of Object.keys(optionMap)) {
      if (text.includes(key)) {
        const index = optionMap[key];
        const value = field.options[index];

        this.values[field.id] = value;
        return { valid: true, value };
      }
    }

    return { valid: false };
  }

  /**
   * Interprets currency values (basic version)
   * Example: "half million" → 500000
   */
  private interpretCurrency(text: string) {
    if (text.includes('half million')) {
      this.values['expected_revenue'] = 500000;
      return { valid: true, value: 500000 };
    }

    if (text.includes('million')) {
      this.values['expected_revenue'] = 1000000;
      return { valid: true, value: 1000000 };
    }

    return { valid: false };
  }

  /**
   * Move to next field after confirmation
   */
  advance(): boolean {
    this.fieldIndex++;

    if (this.fieldIndex >= this.fields.length) {
      this.state = OpportunityVoiceState.COMPLETED;
      return false;
    }

    return true;
  }

  /**
   * Returns captured Opportunity data
   */
  getResult(): Record<string, any> {
    return this.values;
  }
}
