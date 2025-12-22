// src/app/services/voice/speech-normalizer.ts
export class SpeechNormalizer {

  // map spoken number words to digits
  private static digitWords: Record<string, string> = {
    'zero': '0',
    'oh': '0',
    'one': '1',
    'two': '2',
    'to': '2',
    'too': '2',
    'three': '3',
    'four': '4',
    'for': '4',
    'five': '5',
    'six': '6',
    'seven': '7',
    'eight': '8',
    'ate': '8',
    'nine': '9'
  };

  /**
   * Normalize IDs like:
   *  - "op one two three four" → "OP1234"
   *  - "opp n zero one"        → "OPPN01"
   */
  static normalizeId(raw: string): string {
    if (!raw) return raw;

    const original = raw.trim();
    let lower = original.toLowerCase();

    // Replace number words with digits: "one two three" -> "1 2 3"
    lower = lower.replace(
      /\b(zero|oh|one|two|to|too|three|four|for|five|six|seven|eight|ate|nine)\b/g,
      (m: string) => this.digitWords[m] ?? m
    );

    // Collapse letter + digit sequences: "op 1 2 3 4" -> "op1234"
    lower = lower.replace(/([a-z]+)\s*((?:\d\s*)+)/g, (_, letters: string, digits: string) => {
      const d = digits.replace(/\s+/g, '');
      return letters + d;
    });

    // Collapse stray spaces in the middle: "op pn 01" -> "oppn01"
    lower = lower.replace(/\s+/g, '');

    // For IDs we usually want upper-case
    return lower.toUpperCase();
  }
}
