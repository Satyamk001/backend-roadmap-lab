import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import fs from 'fs';
import path from 'path';
import { NotionNotesRenderer } from './NotionNotesRenderer';

describe('NotionNotesRenderer Component Verification', () => {
  it('renders tables into semantic HTML table elements instead of raw text tags', () => {
    const sampleTable = `
## 📖 Level Guide
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

    const { container } = render(<NotionNotesRenderer markdown={sampleTable} />);

    // Table, th, and td elements must exist in DOM
    const tableEl = container.querySelector('table');
    expect(tableEl).toBeInTheDocument();

    const headers = container.querySelectorAll('th');
    expect(headers.length).toBe(3);
    expect(headers[0].textContent).toBe('Level');

    const cells = container.querySelectorAll('td');
    expect(cells.length).toBe(3);
    expect(cells[0].textContent).toContain('5-min revision');

    // No raw table tags should be rendered as visible text
    expect(container.textContent).not.toContain('<table');
    expect(container.textContent).not.toContain('<tr>');
    expect(container.textContent).not.toContain('<td>');
  });

  it('renders callout blocks with icons and children rather than raw <callout> tags', () => {
    const sampleCallout = `
<callout icon="🎯" color="blue_bg">
**Stage:** S4 Caching & Redis · **Day 22**
**Deliverable:** Leaderboard on Redis
</callout>
`;

    const { container } = render(<NotionNotesRenderer markdown={sampleCallout} />);

    expect(screen.getByText('🎯')).toBeInTheDocument();
    expect(container.textContent).toContain('Stage:');
    expect(container.textContent).not.toContain('<callout');
    expect(container.textContent).not.toContain('</callout>');
  });

  it('renders details as interactive collapsible elements', () => {
    const sampleDetails = `
<details>
<summary>Q. Redis single-threaded hai to race condition hoti hai?</summary>
- Nahi. Commands ek-ek karke chalte hain.
</details>
`;

    const { container } = render(<NotionNotesRenderer markdown={sampleDetails} />);

    const detailsEl = container.querySelector('details');
    expect(detailsEl).toBeInTheDocument();
    const summaryEl = container.querySelector('summary');
    expect(summaryEl).toBeInTheDocument();
    expect(summaryEl?.textContent).toContain('single-threaded hai');

    expect(container.textContent).not.toContain('<details');
    expect(container.textContent).not.toContain('<summary>');
  });

  it('renders code blocks with language labels and copy buttons', () => {
    const sampleCode = `
\`\`\`javascript
const redis = new Redis();
await redis.set('foo', 'bar');
\`\`\`
`;

    const { container } = render(<NotionNotesRenderer markdown={sampleCode} />);

    expect(container.querySelector('pre')).toBeInTheDocument();
    expect(container.querySelector('code')).toBeInTheDocument();
    expect(container.textContent).toContain('javascript');
    expect(screen.getByRole('button', { name: /copy code/i })).toBeInTheDocument();
  });

  it('renders full Day 22 notes snapshot with NO raw Notion markup or HTML tags leaked into text', () => {
    const day22Path = path.resolve(
      process.cwd(),
      'content/stages/s4-caching-redis/day-22/notes.md'
    );
    const day22Notes = fs.readFileSync(day22Path, 'utf8');

    const { container } = render(<NotionNotesRenderer markdown={day22Notes} />);

    // Must have rendered tables and details in the DOM
    const tables = container.querySelectorAll('table');
    expect(tables.length).toBeGreaterThan(20);

    const details = container.querySelectorAll('details');
    expect(details.length).toBeGreaterThan(40);

    // Rule 9 Enforcement: no rendered text contains raw tags
    expect(container.textContent).not.toContain('<table');
    expect(container.textContent).not.toContain('<tr>');
    expect(container.textContent).not.toContain('<td>');
    expect(container.textContent).not.toContain('<callout');
    expect(container.textContent).not.toContain('<details');
    expect(container.textContent).not.toContain('<mention-page');
  });
});
