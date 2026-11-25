// The v1 task set: two small, real, deterministic tasks.
//
// Both tasks are pure functions of their input, so a run is fully
// reproducible: anyone holding the input can re-run the task and compare the
// output hash against the anchored log. The run-log schema is task-agnostic —
// an LLM-backed task only needs to return { output, steps } the same way and
// record the real model name in the log.

const RED_FLAG_PATTERNS = [
  { pattern: /\b(guaranteed|100%\s*safe|risk[- ]?free)\b/i, flag: 'absolute_safety_claim' },
  { pattern: /\b(double your|10x|100x|moon|lambo)\b/i, flag: 'unrealistic_return_claim' },
  { pattern: /\b(send|deposit)\b[^.]{0,40}\b(first|upfront)\b/i, flag: 'upfront_payment_request' },
  { pattern: /\b(seed phrase|private key|recovery phrase)\b/i, flag: 'secret_request' },
  { pattern: /\b(limited time|act now|only \d+ left|hurry)\b/i, flag: 'pressure_tactic' },
  { pattern: /\b(telegram|whatsapp)\b[^.]{0,30}\b(only|dm|chat)\b/i, flag: 'off_platform_contact' },
  { pattern: /\b(no escrow|direct transfer|gift card)\b/i, flag: 'unsafe_payment_method' },
];

function listingCheck(input) {
  const text = String(input.text ?? '');
  const steps = [];

  const priceMatch = text.match(/(?:\$|USD|Rp\.?|IDR)\s?[\d][\d.,]*/i);
  steps.push({ step: 'extract_price', found: Boolean(priceMatch) });

  const redFlags = [];
  for (const { pattern, flag } of RED_FLAG_PATTERNS) {
    if (pattern.test(text)) redFlags.push(flag);
  }
  steps.push({ step: 'red_flag_scan', patternsChecked: RED_FLAG_PATTERNS.length, flagsRaised: redFlags.length });

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const hasContact = /(@|wa\.me|t\.me|\bemail\b|\bphone\b|\+\d)/i.test(text);
  const completeness = {
    hasPrice: Boolean(priceMatch),
    hasDescription: words >= 20,
    hasContact: hasContact,
  };
  const completenessScore = Object.values(completeness).filter(Boolean).length;
  steps.push({ step: 'completeness_check', score: completenessScore, of: 3 });

  let verdict = 'pass';
  if (redFlags.includes('secret_request') || redFlags.includes('upfront_payment_request')) verdict = 'fail';
  else if (redFlags.length > 0 || completenessScore < 2) verdict = 'review';

  return {
    output: {
      verdict,
      redFlags,
      priceMention: priceMatch ? priceMatch[0] : null,
      wordCount: words,
      completeness,
    },
    steps,
  };
}

function docDigest(input) {
  const text = String(input.text ?? '');
  const steps = [];

  const lines = text.split('\n');
  const headings = lines
    .filter((l) => /^#{1,6}\s+/.test(l))
    .map((l) => l.replace(/^#+\s+/, '').trim());
  steps.push({ step: 'extract_headings', count: headings.length });

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const readingTimeMinutes = Math.max(1, Math.round(words / 200));
  steps.push({ step: 'word_count', words });

  const freq = new Map();
  for (const raw of text.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) ?? []) {
    freq.set(raw, (freq.get(raw) ?? 0) + 1);
  }
  const keyTerms = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([term, count]) => ({ term, count }));
  steps.push({ step: 'key_terms', count: keyTerms.length });

  return {
    output: {
      wordCount: words,
      lineCount: lines.length,
      readingTimeMinutes,
      headings,
      keyTerms,
    },
    steps,
  };
}

export const TASKS = {
  'listing-check': {
    description: 'Structured risk/completeness check of a marketplace listing text.',
    run: listingCheck,
  },
  'doc-digest': {
    description: 'Structured digest of a text/markdown document (headings, length, key terms).',
    run: docDigest,
  },
};

export function runTask(type, input) {
  const task = TASKS[type];
  if (!task) throw new Error(`unknown task type: ${type} (known: ${Object.keys(TASKS).join(', ')})`);
  return task.run(input);
}
