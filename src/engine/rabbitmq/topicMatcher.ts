/**
 * RabbitMQ AMQP 0-9-1 Topic Exchange Pattern Matcher
 * 
 * Rules:
 * - Routing keys and binding keys are dot-separated words (e.g. "order.created.in").
 * - Words contain letters, digits, dashes, underscores.
 * - Binding keys can contain wildcards:
 *   - '*' matches EXACTLY ONE word.
 *   - '#' matches ZERO OR MORE words.
 */

export function matchesTopic(bindingKey: string, routingKey: string): boolean {
  // If binding is "#", it matches any routing key (including empty or multiple words)
  if (bindingKey === '#') {
    return true;
  }

  // Exact literal match
  if (bindingKey === routingKey) {
    return true;
  }

  const bindingWords = bindingKey.split('.');
  const routingWords = routingKey.length > 0 ? routingKey.split('.') : [];

  return matchWords(bindingWords, 0, routingWords, 0);
}

function matchWords(
  bWords: string[],
  bIdx: number,
  rWords: string[],
  rIdx: number
): boolean {
  // Base case: both consumed
  if (bIdx === bWords.length && rIdx === rWords.length) {
    return true;
  }

  // Binding consumed but routing words remain
  if (bIdx === bWords.length) {
    return false;
  }

  const currentPattern = bWords[bIdx];

  if (currentPattern === '#') {
    // '#' can match 0, 1, or more words
    // Try matching 0 words (advance binding only)
    if (matchWords(bWords, bIdx + 1, rWords, rIdx)) {
      return true;
    }
    // Try matching 1 or more words (advance routing if available)
    if (rIdx < rWords.length) {
      // Consume 1 word and continue trying '#'
      if (matchWords(bWords, bIdx, rWords, rIdx + 1)) {
        return true;
      }
      // Or consume 1 word and advance '#'
      if (matchWords(bWords, bIdx + 1, rWords, rIdx + 1)) {
        return true;
      }
    }
    return false;
  }

  if (rIdx === rWords.length) {
    // Routing consumed, but binding remains.
    // Can only match if all remaining binding words are '#'
    for (let i = bIdx; i < bWords.length; i++) {
      if (bWords[i] !== '#') return false;
    }
    return true;
  }

  // '*' matches exactly 1 word
  if (currentPattern === '*' || currentPattern === rWords[rIdx]) {
    return matchWords(bWords, bIdx + 1, rWords, rIdx + 1);
  }

  return false;
}
