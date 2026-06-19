// migrateVisited.js — one-shot data migration.
//
// Moves each user's `visitedPlaces` array out of the world-readable public doc
// (`users/{uid}`) into the owner-only private doc (`users/{uid}/private/visited`),
// then deletes the public field. This closes the existing leak where anyone could
// read everyone's visited list (and ace the reset quiz).
//
// The client also lazy-migrates on next sign-in, so this script is optional — but
// it's the clean way to sweep all users at once, including dormant accounts.
//
// Run with Admin credentials:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
//     node functions/scripts/migrateVisited.js
// or, against the local emulator:
//   FIRESTORE_EMULATOR_HOST=localhost:8080 \
//     node functions/scripts/migrateVisited.js

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
initializeApp(usingEmulator ? { projectId: 'ivebeensomewhere-tp' } : { credential: applicationDefault() });
const db = getFirestore();

async function run() {
  const users = await db.collection('users').get();
  let moved = 0;
  let skipped = 0;

  for (const docSnap of users.docs) {
    const data = docSnap.data();
    if (!Array.isArray(data.visitedPlaces)) {
      skipped += 1;
      continue;
    }
    const uid = docSnap.id;
    await db.doc(`users/${uid}/private/visited`).set(
      { visitedPlaces: data.visitedPlaces },
      { merge: true },
    );
    await db.doc(`users/${uid}`).update({ visitedPlaces: FieldValue.delete() });
    moved += 1;
    console.log(`migrated ${uid} (${data.visitedPlaces.length} places)`);
  }

  console.log(`\nDone. Migrated ${moved} user(s); ${skipped} had nothing to move.`);
}

run().then(() => process.exit(0)).catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
