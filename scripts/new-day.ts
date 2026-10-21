import fs from 'fs';
import path from 'path';

function parseArgs() {
  const args = process.argv.slice(2);
  const params: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].replace(/^--/, '');
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true';
      params[key] = value;
      if (value !== 'true') i++;
    }
  }
  return params;
}

const params = parseArgs();
const stage = params.stage || params.s;
const day = params.day || params.d;
const title = params.title || params.t || `Day ${day} Topic`;

if (!stage || !day) {
  console.error('Usage: npm run new-day -- --stage <stage-slug> --day <day-number> --title "<title>"');
  console.error('Example: npm run new-day -- --stage s6-queues-async --day 39 --title "Outbox Pattern & Transactional Messaging"');
  process.exit(1);
}

const formattedDay = day.toString().padStart(2, '0');
const daySlug = `day-${formattedDay}`;
const stageSlug = stage.startsWith('s') && !stage.includes('-')
  ? (stage === 's1' ? 's1-nodejs-internals' : stage === 's4' ? 's4-caching-redis' : stage === 's6' ? 's6-queues-async' : stage)
  : stage;

const targetDir = path.join(process.cwd(), 'content', 'stages', stageSlug, daySlug);
const demoSlug = `demo-${stageSlug}-${daySlug}`;

console.log(`Scaffolding new day in: ${targetDir}`);

fs.mkdirSync(targetDir, { recursive: true });

// 1. Write meta.json
const metaPath = path.join(targetDir, 'meta.json');
if (!fs.existsSync(metaPath)) {
  const metaContent = {
    dayNumber: parseInt(day, 10),
    title: title,
    stageId: stageSlug,
    trackerTask: title,
    definition: `One-line mental model definition for ${title}.`,
    keyPoints: [
      {
        icon: '⚡',
        title: 'Core Mechanism',
        description: `How ${title} processes state and guarantees under the hood.`
      },
      {
        icon: '🛡️',
        title: 'Failure Modes',
        description: 'How the system handles crashes, retries, and data durability.'
      },
      {
        icon: '⚙️',
        title: 'Production Tradeoffs',
        description: 'Architectural compromises and scaling considerations.'
      }
    ],
    recap: `2-3 sentence Hinglish narrative summary for ${title}.`,
    concepts: ['Core Mechanics', 'Failure Scenarios', 'Production Considerations'],
    demos: [
      {
        id: demoSlug,
        title: `${title} Interactive Demo`,
        summary: `Interactive simulation visualizer for ${title}.`,
        difficulty: 'medium',
        notesAnchor: 'overview'
      }
    ],
    notesUrl: '',
    notionPageId: '',
    lastSynced: new Date().toISOString(),
    status: 'draft'
  };
  fs.writeFileSync(metaPath, JSON.stringify(metaContent, null, 2));
  console.log(`Created: ${metaPath}`);
} else {
  console.log(`meta.json already exists in ${targetDir}`);
}

// 2. Write notes.md
const notesPath = path.join(targetDir, 'notes.md');
if (!fs.existsSync(notesPath)) {
  const notesTemplate = `# 🗒️ Notes: ${title} (Day ${day})

## 📌 Overview
- Aaj ka goal: ${title} ko deep dive me samajhna.
- Mental model: Ek line me concepts and architectural tradeoffs.

## ⚙️ Architecture & Failure Modes
- Key points and production considerations.
`;
  fs.writeFileSync(notesPath, notesTemplate);
  console.log(`Created: ${notesPath}`);
}

// 3. Create demo stub
const demoDir = path.join(process.cwd(), 'src', 'demos', stageSlug, daySlug);
fs.mkdirSync(demoDir, { recursive: true });
const demoFilePath = path.join(demoDir, 'IndexDemo.tsx');

if (!fs.existsSync(demoFilePath)) {
  const demoCode = `import React from 'react';
import PlaceholderDemo from '../../placeholder/PlaceholderDemo';

export const Day${day}Demo: React.FC = () => {
  return <PlaceholderDemo />;
};

export default Day${day}Demo;
`;
  fs.writeFileSync(demoFilePath, demoCode);
  console.log(`Created demo stub: ${demoFilePath}`);
}

console.log(`
Day ${day} scaffolded successfully!
Run "npm run dev" to see it live in navigation!
`);
