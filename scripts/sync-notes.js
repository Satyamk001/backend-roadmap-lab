/**
 * scripts/sync-notes.js
 * 
 * Re-pulls changed Notion notes pages through the Notion MCP into content/stages/.
 * For agent sessions:
 * 1. Read each day's meta.json to locate its notionPageId.
 * 2. Invoke Notion MCP `API-retrieve-page-markdown` with the page_id.
 * 3. Update `notes.md` and set `lastSynced` in `meta.json`.
 */

import fs from 'fs';
import path from 'path';

const contentStagesDir = path.join(process.cwd(), 'content', 'stages');

console.log('=== Notion Study Notes Synchronization Registry ===\n');

if (!fs.existsSync(contentStagesDir)) {
  console.log('No content/stages directory found.');
  process.exit(0);
}

const stageDirs = fs.readdirSync(contentStagesDir);
let totalDays = 0;

stageDirs.forEach((stageSlug) => {
  const stagePath = path.join(contentStagesDir, stageSlug);
  if (!fs.statSync(stagePath).isDirectory()) return;

  const dayDirs = fs.readdirSync(stagePath).filter((d) => d.startsWith('day-'));

  dayDirs.forEach((daySlug) => {
    const metaFile = path.join(stagePath, daySlug, 'meta.json');
    if (fs.existsSync(metaFile)) {
      totalDays++;
      const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
      console.log(`[Day ${meta.dayNumber}] ${meta.title}`);
      console.log(`  Stage: ${stageSlug}`);
      console.log(`  Notion Page ID: ${meta.notionPageId || 'Not linked yet'}`);
      console.log(`  Last Synced: ${meta.lastSynced || 'Never'}`);
      console.log(`  Notes URL: ${meta.notesUrl || 'N/A'}`);
      console.log('----------------------------------------------------');
    }
  });
});

console.log(`\nTotal study days registered: ${totalDays}`);
console.log('\nAgent Instruction: When refreshing notes in an agent session, call Notion MCP API-retrieve-page-markdown for any updated page ID, write to notes.md, and update lastSynced in meta.json.');
