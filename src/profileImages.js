// Dynamically discovers every preset profile image dropped into
// `src/ProfileImages/`. Add a square .webp file there and it shows up as a
// selectable avatar automatically — no code change required. The filename
// (minus its extension) becomes the stable `key` we persist for the user.
//
// Images in the `LIMITED/` subfolder are restricted: they are only offered to
// the protected owner account (see `reservedNames.js` / UserSettingsModal).
const standard = import.meta.glob('./ProfileImages/*.{webp,WEBP}', {
  eager: true,
  query: '?url',
  import: 'default',
});
const limited = import.meta.glob('./ProfileImages/LIMITED/*.{webp,WEBP}', {
  eager: true,
  query: '?url',
  import: 'default',
});

function toEntry(path, url, isLimited) {
  const file = path.split('/').pop();
  const key = file.replace(/\.webp$/i, '');
  return { key, file, url, limited: isLimited };
}

export const profileImages = [
  ...Object.entries(standard).map(([path, url]) => toEntry(path, url, false)),
  ...Object.entries(limited).map(([path, url]) => toEntry(path, url, true)),
].sort((a, b) => {
  // Standard images first, then limited; alphabetical within each group.
  if (a.limited !== b.limited) return a.limited ? 1 : -1;
  return a.key.localeCompare(b.key, undefined, { numeric: true });
});

// Resolve a stored key back to its image URL (null = use the monogram).
export function profileImageUrl(key) {
  if (!key) return null;
  const match = profileImages.find((img) => img.key === key);
  return match ? match.url : null;
}
