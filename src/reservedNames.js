// Guards the protected handle "TrueProblematic". Nobody may register or rename
// to it — or anything close enough to impersonate it — except the one account
// that already owns it. The exact name is also protected at the data layer by
// its existing `usernames/trueproblematic` reservation doc, but that can't
// catch look-alikes, so we normalize aggressively and fuzzy-match here.

// The exact, case-sensitive handle that the legitimate owner holds.
export const PROTECTED_USERNAME = 'TrueProblematic';

// Canonical form we compare candidates against.
const PROTECTED_CANONICAL = 'trueproblematic';

// Common character swaps people use to dodge a block (leetspeak, look-alikes).
const LEET = {
  '0': 'o', '1': 'i', '2': 'z', '3': 'e', '4': 'a', '5': 's',
  '6': 'g', '7': 't', '8': 'b', '9': 'g', '@': 'a', '$': 's',
  '!': 'i', '|': 'l', '£': 'l',
};

// Collapse a name to bare lowercase letters, folding leet substitutions, so
// "Tru3_Pr0blematic!", "true.problematic" etc. all reduce to the same string.
export function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .split('')
    .map((ch) => LEET[ch] || ch)
    .join('')
    .replace(/[^a-z]/g, '');
}

// Classic Levenshtein edit distance (small strings, fine to do inline).
function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// True when `name` is the protected handle or too close to it to allow.
// Catches: leet/punctuation variants, the name embedded in a longer string
// ("xTrueProblematic", "TrueProblematicFan"), and small typos/edits. Deliberately
// does NOT block arbitrary fragments (e.g. "Problematic" on its own) so ordinary
// usernames aren't caught — only genuine look-alikes of the full handle.
export function isProtectedUsername(name) {
  const n = normalizeName(name);
  if (!n) return false;
  if (n.includes(PROTECTED_CANONICAL)) return true; // contains the full handle
  return editDistance(n, PROTECTED_CANONICAL) <= 2; // near-miss typo of the full handle
}

// Whether `name`, exactly as typed, is the legitimate protected handle. The
// owner is allowed to use this one value; everyone else (and every look-alike)
// is rejected by isProtectedUsername.
export function isExactProtectedUsername(name) {
  return name === PROTECTED_USERNAME;
}
