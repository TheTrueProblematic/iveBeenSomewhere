// restoreVisited.js — inspect and repair a user's visited list.
//
// Written after a client bug wiped an account's list: the store's sign-in
// handler treated a cache-only "document does not exist" snapshot as a first
// sign-in and merged `visitedCount: 0` / `visitedPlaces: []` over live data.
// The client fix is in `src/store.js` (see `ensureUserDocs`); this script is the
// admin-side counterpart for putting a list back and for keeping the public
// `visitedCount` honest.
//
// Every write goes through a transaction that rewrites the private list and the
// public count together, so the leaderboard can never disagree with the list.
//
// Run with Admin credentials (ADC from `gcloud auth application-default login`,
// or an explicit service account):
//   node functions/scripts/restoreVisited.js --show TrueProblematic
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
//     node functions/scripts/restoreVisited.js --set TrueProblematic --ids 0,1,2
// or, against the local emulator:
//   FIRESTORE_EMULATOR_HOST=localhost:8080 \
//     node functions/scripts/restoreVisited.js --show TrueProblematic
//
// Modes:
//   --show <user>                 print the stored list, count, and any mismatch
//   --set  <user> --ids 0,1,2     replace the list with exactly these places
//   --set  <user> --names "Reno,Chicago"    same, resolved by place name
//   --add  <user> --ids 4,5       union the given places into the existing list
//   --reconcile                   fix every user's visitedCount to match its list
//   --dry-run                     print what would change, write nothing
//
// <user> is a username (case-insensitive, resolved via `usernames/`) or a raw uid.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Pin the project explicitly: ADC infers its project from the local gcloud
// config, which is often pointed at something else entirely.
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'ivebeensomewhere-tp';
const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
initializeApp(usingEmulator
  ? { projectId: PROJECT_ID }
  : { credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore();

const here = dirname(fileURLToPath(import.meta.url));
const PLACES = JSON.parse(readFileSync(join(here, '..', 'places.slim.json'), 'utf8'));
const BY_ID = new Map(PLACES.map((p) => [String(p.id), p]));
const BY_NAME = new Map(PLACES.map((p) => [p.name.toLowerCase(), p]));

// ---------------------------------------------------------------- arg parsing

function parseArgs(argv) {
  const opts = { dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) throw new Error(`${arg} needs a value`);
      i += 1;
      return v;
    };
    switch (arg) {
      case '--show': opts.mode = 'show'; opts.user = next(); break;
      case '--set': opts.mode = 'set'; opts.user = next(); break;
      case '--add': opts.mode = 'add'; opts.user = next(); break;
      case '--reconcile': opts.mode = 'reconcile'; break;
      case '--ids': opts.ids = next(); break;
      case '--names': opts.names = next(); break;
      case '--dry-run': opts.dryRun = true; break;
      default: throw new Error(`unknown argument: ${arg}`);
    }
  }
  return opts;
}

const splitList = (s) => s.split(',').map((v) => v.trim()).filter(Boolean);

// Resolve --ids / --names into canonical string place ids, rejecting anything
// that isn't a real place so a typo can't silently write junk into the list.
function resolvePlaceIds(opts) {
  const ids = [];
  const unknown = [];

  for (const raw of opts.ids ? splitList(opts.ids) : []) {
    if (BY_ID.has(raw)) ids.push(raw);
    else unknown.push(raw);
  }
  for (const raw of opts.names ? splitList(opts.names) : []) {
    const place = BY_NAME.get(raw.toLowerCase());
    if (place) ids.push(String(place.id));
    else unknown.push(raw);
  }

  if (unknown.length) {
    throw new Error(`not a known place id or name: ${unknown.join(', ')}`);
  }
  return Array.from(new Set(ids));
}

// ------------------------------------------------------------------- helpers

async function resolveUid(user) {
  const byName = await db.doc(`usernames/${user.toLowerCase()}`).get();
  if (byName.exists && byName.data().uid) return byName.data().uid;

  const asUid = await db.doc(`users/${user}`).get();
  if (asUid.exists) return user;

  throw new Error(`no user found for "${user}" (tried usernames/${user.toLowerCase()} and users/${user})`);
}

async function readState(uid) {
  const [publicSnap, visitedSnap] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`users/${uid}/private/visited`).get(),
  ]);
  const list = visitedSnap.exists && Array.isArray(visitedSnap.data().visitedPlaces)
    ? visitedSnap.data().visitedPlaces.map(String)
    : [];
  return {
    username: publicSnap.exists ? publicSnap.data().username : null,
    count: publicSnap.exists ? (publicSnap.data().visitedCount ?? 0) : 0,
    list,
    updatedAt: visitedSnap.exists ? visitedSnap.updateTime?.toDate().toISOString() : null,
  };
}

const describe = (ids) => ids
  .map((id) => `${id}:${BY_ID.get(id)?.name ?? '(unknown)'}`)
  .join(', ');

// Rewrite the list and the public count together, so they can never drift.
async function writeList(uid, nextList, { dryRun }) {
  if (dryRun) {
    console.log(`[dry run] would write ${nextList.length} place(s) to users/${uid}`);
    return;
  }
  await db.runTransaction(async (tx) => {
    tx.set(db.doc(`users/${uid}/private/visited`), { visitedPlaces: nextList }, { merge: true });
    tx.set(db.doc(`users/${uid}`), { visitedCount: nextList.length }, { merge: true });
  });
}

// ---------------------------------------------------------------------- modes

async function show(user) {
  const uid = await resolveUid(user);
  const { username, count, list, updatedAt } = await readState(uid);
  console.log(`user:         ${username ?? '(no public doc)'} (${uid})`);
  console.log(`visitedCount: ${count}`);
  console.log(`list length:  ${list.length}${count !== list.length ? '   <-- MISMATCH' : ''}`);
  console.log(`list updated: ${updatedAt ?? '(no private doc)'}`);
  console.log(`places:       ${list.length ? describe(list) : '(empty)'}`);
}

async function setList(user, mode, opts) {
  const requested = resolvePlaceIds(opts);
  if (!requested.length) {
    throw new Error('--set/--add needs at least one place via --ids or --names');
  }

  const uid = await resolveUid(user);
  const before = await readState(uid);
  const next = mode === 'add'
    ? Array.from(new Set([...before.list, ...requested]))
    : requested;

  console.log(`user:   ${before.username ?? '(no public doc)'} (${uid})`);
  console.log(`before: ${before.list.length} place(s) — ${before.list.length ? describe(before.list) : '(empty)'}`);
  console.log(`after:  ${next.length} place(s) — ${describe(next)}`);

  await writeList(uid, next, opts);
  if (!opts.dryRun) console.log(`\nWrote ${next.length} place(s); visitedCount set to ${next.length}.`);
}

// Sweep every user and make the public count match the private list. Catches
// any account left inconsistent by a partial write.
async function reconcile({ dryRun }) {
  const users = await db.collection('users').get();
  let fixed = 0;

  for (const docSnap of users.docs) {
    const { username, count, list } = await readState(docSnap.id);
    if (count === list.length) continue;
    console.log(`${username ?? docSnap.id}: visitedCount ${count} -> ${list.length}`);
    if (!dryRun) {
      await db.doc(`users/${docSnap.id}`).set({ visitedCount: list.length }, { merge: true });
    }
    fixed += 1;
  }

  console.log(`\n${dryRun ? 'Would fix' : 'Fixed'} ${fixed} of ${users.size} user(s).`);
}

// ----------------------------------------------------------------------- main

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  switch (opts.mode) {
    case 'show': return show(opts.user);
    case 'set':
    case 'add': return setList(opts.user, opts.mode, opts);
    case 'reconcile': return reconcile(opts);
    default:
      throw new Error('pick a mode: --show, --set, --add or --reconcile (see the header comment)');
  }
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(`restoreVisited failed: ${err.message}`);
  process.exit(1);
});
