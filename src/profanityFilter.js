// Username moderation: flags handles containing profanity or hate speech.
//
// Matching is done on a normalized form (lowercased, leetspeak folded,
// punctuation/spacing stripped, runs of a repeated letter squeezed) so common
// evasions like "f.u.c.k", "sh1t", "fuuuck" are still caught. Known-safe words
// are removed first to avoid the "Scunthorpe problem" (false positives such as
// "class", "japan", "pakistan", "raccoon").
//
// This is a substring blocklist, not a language model — it will never be
// perfect. Extend the lists below as needed. Hate-speech terms are base64-encoded
// so this source file isn't a plaintext dump of slurs; decode/encode with
// atob/btoa (lowercase, letters only).

const LEET = {
  '0': 'o', '1': 'i', '2': 'z', '3': 'e', '4': 'a', '5': 's',
  '6': 'g', '7': 't', '8': 'b', '9': 'g', '@': 'a', '$': 's',
  '!': 'i', '|': 'l', '£': 'l',
};

// General profanity (kept in plaintext — these are mild). Bare ambiguous stems
// like "ass" / "sex" are intentionally omitted to avoid false positives; the
// compound forms ("asshole", "dumbass") are listed instead.
const PROFANITY = [
  'fuck', 'shit', 'bitch', 'cunt', 'asshole', 'dumbass', 'jackass', 'bastard',
  'motherfucker', 'bullshit', 'dickhead', 'piss', 'slut', 'whore', 'wanker',
  'twat', 'prick', 'douche', 'dildo', 'blowjob', 'jerkoff', 'cocksucker',
];

// Hate-speech slurs, base64-encoded (see header note).
const HATE_B64 = [
  'bmlnZ2Vy', 'bmlnZ2E=', 'ZmFnZ290', 'ZmFn', 'cmV0YXJk', 'dHJhbm55',
  'Y2hpbms=', 'c3BpYw==', 'a2lrZQ==', 'Z29vaw==', 'd2V0YmFjaw==', 'Y29vbg==',
  'ZHlrZQ==', 'YmVhbmVy', 'cmFnaGVhZA==', 'dG93ZWxoZWFk', 'cGFraQ==', 'd29w',
  'aGVlYg==', 'amFw', 'bmVncm8=', 'c2FuZG5pZ2dlcg==', 'd2hpdGVwb3dlcg==', 'aGVpbGhpdGxlcg==',
];
const HATE = HATE_B64.map((b) => atob(b));

// Innocent words that contain a blocklisted substring. Removed from the scan
// string before matching so they don't trip a false positive. Longer entries
// are stripped first so they win over shorter overlaps.
const ALLOWLIST = [
  // profanity false-positives
  'class', 'grass', 'glass', 'brass', 'bass', 'passport', 'password', 'passion',
  'passover', 'compass', 'passenger', 'pass', 'massachusetts', 'massive', 'mass',
  'assassin', 'assess', 'assist', 'assignment', 'assign', 'asset', 'assembly',
  'assemble', 'assume', 'embassy', 'ambassador', 'cassette', 'scunthorpe',
  'penistone', 'cocktail', 'cockpit', 'cockburn', 'cockerel', 'peacock',
  'hancock', 'shuttlecock', 'woodcock', 'analysis', 'analyst', 'analyze',
  'canal', 'arsenal', 'dickens', 'dickinson',
  // hate-term false-positives
  'japanese', 'japan', 'pakistani', 'pakistan', 'montenegro', 'raccoon',
  'cocoon', 'tycoon', 'saskatoon', 'lagoon', 'monsoon', 'despicable',
  'auspicious', 'suspicious', 'conspicuous', 'spice', 'spicy', 'vandyke',
  'gobbledygook', 'spooky', 'spook', 'retardant', 'fagin',
].sort((a, b) => b.length - a.length);

// Squeeze runs of 3+ identical letters down to one ("fuuuck" -> "fuck").
function squeeze(s) {
  return s.replace(/(.)\1{2,}/g, '$1');
}

// Reduce a name to bare lowercase letters with leetspeak folded.
export function normalizeForMatch(name) {
  return String(name || '')
    .toLowerCase()
    .split('')
    .map((ch) => LEET[ch] || ch)
    .join('')
    .replace(/[^a-z]/g, '');
}

// Returns { category, term } describing the first match, or null if the name is
// clean. `category` is 'hate speech' or 'profanity'; `term` is the matched token.
export function screenUsername(name) {
  const normalized = normalizeForMatch(name);
  if (!normalized) return null;

  // Strip known-safe words so embedded substrings don't false-positive.
  let scan = normalized;
  for (const safe of ALLOWLIST) {
    if (scan.includes(safe)) scan = scan.split(safe).join(' ');
  }
  const variants = [scan, squeeze(scan)];

  for (const term of HATE) {
    if (variants.some((v) => v.includes(term))) return { category: 'hate speech', term };
  }
  for (const term of PROFANITY) {
    if (variants.some((v) => v.includes(term))) return { category: 'profanity', term };
  }
  return null;
}

// Convenience boolean.
export function isProfaneUsername(name) {
  return screenUsername(name) !== null;
}
