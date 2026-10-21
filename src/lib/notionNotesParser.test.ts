import { describe, it, expect } from 'vitest';
import { parseNotionMarkdown, parseInlineSpans } from './notionNotesParser';

describe('notionNotesParser', () => {
  describe('parseInlineSpans', () => {
    it('parses plain text', () => {
      const spans = parseInlineSpans('Hello world');
      expect(spans).toEqual([{ type: 'text', text: 'Hello world' }]);
    });

    it('parses bold text and nested inline code', () => {
      const spans = parseInlineSpans('Pehla **`SET`** command');
      expect(spans).toHaveLength(3);
      expect(spans[0]).toEqual({ type: 'text', text: 'Pehla ' });
      expect(spans[1].type).toBe('bold');
      if (spans[1].type === 'bold') {
        expect(spans[1].children).toEqual([{ type: 'code', code: 'SET' }]);
      }
      expect(spans[2]).toEqual({ type: 'text', text: ' command' });
    });

    it('parses links and mention tags', () => {
      const spans = parseInlineSpans(
        'Check [Docs](https://redis.io) or <mention-page url="https://notion.so/p1"/>'
      );
      expect(spans.some((s) => s.type === 'link')).toBe(true);
      expect(spans.some((s) => s.type === 'mention')).toBe(true);
    });
  });

  describe('parseNotionMarkdown blocks', () => {
    it('parses HTML tables with header rows', () => {
      const raw = `
<table fit-page-width="true" header-row="true">
<tr>
<td>Level</td>
<td>Kab</td>
<td>Kya padhna hai</td>
</tr>
<tr>
<td>⚡ **5-min revision**</td>
<td>Interview / exam se pehle</td>
<td>Sirf **Cheat Sheet**</td>
</tr>
</table>
`;
      const blocks = parseNotionMarkdown(raw);
      expect(blocks).toHaveLength(1);
      const table = blocks[0];
      expect(table.type).toBe('table');
      if (table.type === 'table') {
        expect(table.hasHeader).toBe(true);
        expect(table.headers?.cells).toHaveLength(3);
        expect(table.rows).toHaveLength(1);
        expect(table.rows[0].cells).toHaveLength(3);
      }
    });

    it('parses callout blocks', () => {
      const raw = `
<callout icon="🎯" color="blue_bg">
  **Stage:** S4 Caching & Redis
  **Deliverable:** Leaderboard on Redis
</callout>
`;
      const blocks = parseNotionMarkdown(raw);
      expect(blocks).toHaveLength(1);
      const callout = blocks[0];
      expect(callout.type).toBe('callout');
      if (callout.type === 'callout') {
        expect(callout.icon).toBe('🎯');
        expect(callout.color).toBe('blue_bg');
        expect(callout.children.length).toBeGreaterThan(0);
      }
    });

    it('parses details and summary blocks', () => {
      const raw = `
<details>
<summary>Q. Redis single-threaded hai to race condition hoti hai?</summary>
- Nahi. Commands ek-ek karke chalte hain.
</details>
`;
      const blocks = parseNotionMarkdown(raw);
      expect(blocks).toHaveLength(1);
      const details = blocks[0];
      expect(details.type).toBe('details');
      if (details.type === 'details') {
        expect(details.summary).toContain('single-threaded hai');
        expect(details.children.length).toBeGreaterThan(0);
      }
    });

    it('parses code blocks, headings, and lists', () => {
      const raw = `
## 📖 Heading 2

- Item 1
- Item 2 with **bold**

\`\`\`javascript
const redis = new Redis();
\`\`\`
`;
      const blocks = parseNotionMarkdown(raw);
      expect(blocks.map((b) => b.type)).toEqual(['heading', 'list', 'code']);
    });

    it('successfully parses full Day 22 notes snapshot with all 36 tables, 31 callouts, and 64 details', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const day22Path = path.resolve(process.cwd(), 'content/stages/s4-caching-redis/day-22/notes.md');
      const day22Notes = fs.readFileSync(day22Path, 'utf8');
      const blocks = parseNotionMarkdown(day22Notes);

      expect(blocks.length).toBeGreaterThan(100);
      const tables = blocks.filter((b) => b.type === 'table');
      expect(tables.length).toBe(36);
      const callouts = blocks.filter((b) => b.type === 'callout');
      expect(callouts.length).toBe(31);
      const details = blocks.filter((b) => b.type === 'details');
      expect(details.length).toBe(64);
    });
  });
});

