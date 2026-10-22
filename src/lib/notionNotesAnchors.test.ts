import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  HeadingBlock,
  parseNotionMarkdown,
  slugifyHeading,
} from './notionNotesParser';

const day22Dir = path.resolve(
  process.cwd(),
  'content',
  'stages',
  's4-caching-redis',
  'day-22'
);

describe('Notes heading anchors', () => {
  it('strips keycap emojis before slugifying headings', () => {
    expect(slugifyHeading('2️⃣ Strings')).toBe('strings');
    expect(
      slugifyHeading('1️⃣1️⃣ Memory & Eviction (persistence se pehle ye zaruri)')
    ).toBe('memory-eviction-persistence-se-pehle-ye-zaruri');
    expect(slugifyHeading('1️⃣2️⃣ Persistence #1: RDB (Snapshot)')).toBe(
      'persistence-1-rdb-snapshot'
    );
  });

  it('gives every heading a unique id', () => {
    const notes = fs.readFileSync(path.join(day22Dir, 'notes.md'), 'utf8');
    const headings = parseNotionMarkdown(notes).filter(
      (block): block is HeadingBlock => block.type === 'heading'
    );
    const ids = headings.map((heading) => heading.id);

    expect(ids.length).toBeGreaterThan(20);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('points every Day 22 demo at a real notes heading', () => {
    const notes = fs.readFileSync(path.join(day22Dir, 'notes.md'), 'utf8');
    const meta = JSON.parse(
      fs.readFileSync(path.join(day22Dir, 'meta.json'), 'utf8')
    ) as { demos: Array<{ id: string; notesAnchor: string }> };

    const headingIds = new Set(
      parseNotionMarkdown(notes)
        .filter((block): block is HeadingBlock => block.type === 'heading')
        .map((heading) => heading.id)
    );

    for (const demo of meta.demos) {
      expect(
        headingIds.has(demo.notesAnchor),
        `Demo "${demo.id}" points at missing notes heading "${demo.notesAnchor}"`
      ).toBe(true);
    }
  });

  it('points every Day 1 demo at a real notes heading', () => {
    const day1Dir = path.resolve(
      process.cwd(),
      'content',
      'stages',
      's1-nodejs-internals',
      'day-01'
    );
    const notes = fs.readFileSync(path.join(day1Dir, 'notes.md'), 'utf8');
    const meta = JSON.parse(
      fs.readFileSync(path.join(day1Dir, 'meta.json'), 'utf8')
    ) as { demos: Array<{ id: string; notesAnchor: string }> };

    const headingIds = new Set(
      parseNotionMarkdown(notes)
        .filter((block): block is HeadingBlock => block.type === 'heading')
        .map((heading) => heading.id)
    );

    for (const demo of meta.demos) {
      expect(
        headingIds.has(demo.notesAnchor),
        `Demo "${demo.id}" points at missing notes heading "${demo.notesAnchor}"`
      ).toBe(true);
    }
  });
});
