/**
 * Pure TypeScript parser for Notion study snapshot markdown.
 * Parses Notion-specific tags (<table...>, <callout...>, <details...>, <mention-page...>)
 * and standard Markdown elements into a structured typed AST without external dependencies.
 */

export interface TextSpan {
  type: 'text';
  text: string;
}

export interface BoldSpan {
  type: 'bold';
  children: InlineSpan[];
}

export interface ItalicSpan {
  type: 'italic';
  children: InlineSpan[];
}

export interface CodeSpan {
  type: 'code';
  code: string;
}

export interface LinkSpan {
  type: 'link';
  text: string;
  url: string;
}

export interface MentionSpan {
  type: 'mention';
  url?: string;
  title?: string;
}

export type InlineSpan =
  | TextSpan
  | BoldSpan
  | ItalicSpan
  | CodeSpan
  | LinkSpan
  | MentionSpan;

export interface TableCell {
  inlines: InlineSpan[];
}

export interface TableRow {
  isHeader?: boolean;
  cells: TableCell[];
}

export interface TableBlock {
  type: 'table';
  hasHeader: boolean;
  headers?: TableRow;
  rows: TableRow[];
}

export interface CalloutBlock {
  type: 'callout';
  icon: string;
  color?: string;
  children: Block[];
}

export interface DetailsBlock {
  type: 'details';
  summary: string;
  summaryInlines: InlineSpan[];
  children: Block[];
}

export interface CodeBlock {
  type: 'code';
  language: string;
  code: string;
}

export interface HeadingBlock {
  type: 'heading';
  level: number;
  text: string;
  inlines: InlineSpan[];
}

export interface ListItem {
  inlines: InlineSpan[];
}

export interface ListBlock {
  type: 'list';
  ordered: boolean;
  items: ListItem[];
}

export interface BlockquoteBlock {
  type: 'blockquote';
  inlines: InlineSpan[];
}

export interface DividerBlock {
  type: 'divider';
}

export interface ParagraphBlock {
  type: 'paragraph';
  inlines: InlineSpan[];
}

export type Block =
  | TableBlock
  | CalloutBlock
  | DetailsBlock
  | CodeBlock
  | HeadingBlock
  | ListBlock
  | BlockquoteBlock
  | DividerBlock
  | ParagraphBlock;

/**
 * Tokenizes an inline markdown string into structured spans.
 * Handles mentions, bold (**), inline code (`), links ([text](url)), italics (*), and plain text.
 */
export function parseInlineSpans(input: string): InlineSpan[] {
  if (!input) return [];

  const spans: InlineSpan[] = [];
  let remaining = input;

  while (remaining.length > 0) {
    // 1. Mention page: <mention-page url="..." ... /> or <mention-page url="...">Title</mention-page>
    const mentionMatch = remaining.match(/^<mention-page(?:[^>]*?url="([^"]*)")?[^>]*?(?:\/>|>([\s\S]*?)<\/mention-page>)/i);
    if (mentionMatch) {
      const url = mentionMatch[1];
      const title = mentionMatch[2]?.trim();
      spans.push({
        type: 'mention',
        url,
        title: title || (url ? 'Notion Page' : undefined),
      });
      remaining = remaining.slice(mentionMatch[0].length);
      continue;
    }

    // 2. Bold: **text**
    const boldMatch = remaining.match(/^\*\*([\s\S]+?)\*\*/);
    if (boldMatch) {
      spans.push({
        type: 'bold',
        children: parseInlineSpans(boldMatch[1]),
      });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // 3. Inline code: `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      spans.push({
        type: 'code',
        code: codeMatch[1],
      });
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // 4. Markdown link: [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      spans.push({
        type: 'link',
        text: linkMatch[1],
        url: linkMatch[2],
      });
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // 5. Italic: *text* (excluding **)
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      spans.push({
        type: 'italic',
        children: parseInlineSpans(italicMatch[1]),
      });
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // 6. Find earliest match of any special delimiter
    const nextSpecialIndex = remaining.search(/<mention-page|\*\*|`|\[|\*/i);
    if (nextSpecialIndex === -1) {
      // No more special tokens; add rest as plain text
      spans.push({ type: 'text', text: remaining });
      break;
    } else if (nextSpecialIndex > 0) {
      spans.push({ type: 'text', text: remaining.slice(0, nextSpecialIndex) });
      remaining = remaining.slice(nextSpecialIndex);
    } else {
      // Delimiter at index 0 didn't match full pattern (e.g. single asterisk or unmatched bracket), consume 1 char
      spans.push({ type: 'text', text: remaining[0] });
      remaining = remaining.slice(1);
    }
  }

  // Merge adjacent text spans
  const merged: InlineSpan[] = [];
  for (const span of spans) {
    if (span.type === 'text') {
      const prev = merged[merged.length - 1];
      if (prev && prev.type === 'text') {
        prev.text += span.text;
      } else {
        merged.push({ ...span });
      }
    } else {
      merged.push(span);
    }
  }

  return merged;
}

/**
 * Parses an HTML table block like:
 * <table fit-page-width="true" header-row="true">
 * <tr><td>Level</td><td>Kab</td></tr>
 * <tr><td>⚡ 5-min</td><td>Interview</td></tr>
 * </table>
 */
function parseTableBlock(rawHtml: string): TableBlock {
  const isHeaderAttr = /header-row="true"/i.test(rawHtml);
  const rowMatches = [...rawHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

  const rows: TableRow[] = [];
  rowMatches.forEach((rm, idx) => {
    const rowContent = rm[1];
    const cellMatches = [...rowContent.matchAll(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi)];
    const isHeaderRow = (isHeaderAttr && idx === 0) || cellMatches.some(c => c[1].toLowerCase() === 'th');

    const cells: TableCell[] = cellMatches.map(cm => {
      const cellText = cm[2].trim().replace(/\n+/g, ' ');
      return {
        inlines: parseInlineSpans(cellText),
      };
    });

    if (cells.length > 0) {
      rows.push({
        isHeader: isHeaderRow,
        cells,
      });
    }
  });

  const headerRow = rows.find(r => r.isHeader) || (rows.length > 0 && isHeaderAttr ? rows[0] : undefined);
  const dataRows = headerRow ? rows.filter(r => r !== headerRow) : rows;

  return {
    type: 'table',
    hasHeader: Boolean(headerRow),
    headers: headerRow,
    rows: dataRows,
  };
}

/**
 * Main parser: transforms Notion markdown snapshot text into an array of Block elements.
 */
export function parseNotionMarkdown(raw: string): Block[] {
  if (!raw || !raw.trim()) return [];

  // 1. Sanitize top-level empty blocks & database blocks that add no value
  let cleaned = raw
    .replace(/<empty-block\/>/gi, '')
    .replace(/<database[^>]*>[\s\S]*?<\/database>/gi, '')
    .trim();

  const blocks: Block[] = [];

  // We scan using regular expressions for multi-line block elements:
  // - ```code```
  // - <table...>...</table>
  // - <callout...>...</callout>
  // - <details>...</details>
  // Or line-by-line for headings, lists, quotes, dividers, and paragraphs.

  while (cleaned.length > 0) {
    // Trim leading whitespace newlines
    cleaned = cleaned.replace(/^\n+/, '');
    if (!cleaned) break;

    // Check 1: Code block ```lang ... ```
    const codeMatch = cleaned.match(/^```([^\r\n]*)\r?\n([\s\S]*?)\r?\n```/);
    if (codeMatch) {
      blocks.push({
        type: 'code',
        language: codeMatch[1]?.trim().toLowerCase() || '',
        code: codeMatch[2],
      });
      cleaned = cleaned.slice(codeMatch[0].length);
      continue;
    }

    // Check 2: Table block <table...>...</table>
    const tableMatch = cleaned.match(/^<table[^>]*>([\s\S]*?)<\/table>/i);
    if (tableMatch) {
      blocks.push(parseTableBlock(tableMatch[0]));
      cleaned = cleaned.slice(tableMatch[0].length);
      continue;
    }

    // Check 3: Callout block <callout...>...</callout>
    const calloutMatch = cleaned.match(/^<callout(?:\s+icon="([^"]*)")?(?:\s+color="([^"]*)")?[^>]*>([\s\S]*?)<\/callout>/i);
    if (calloutMatch) {
      const icon = calloutMatch[1] || '💡';
      const color = calloutMatch[2];
      const innerContent = calloutMatch[3].trim();
      const children = parseNotionMarkdown(innerContent);
      blocks.push({
        type: 'callout',
        icon,
        color,
        children: children.length > 0 ? children : [{ type: 'paragraph', inlines: parseInlineSpans(innerContent) }],
      });
      cleaned = cleaned.slice(calloutMatch[0].length);
      continue;
    }

    // Check 4: Details block <details>...</details>
    const detailsMatch = cleaned.match(/^<details[^>]*>([\s\S]*?)<\/details>/i);
    if (detailsMatch) {
      const inner = detailsMatch[1].trim();
      const summaryMatch = inner.match(/<summary>([\s\S]*?)<\/summary>/i);
      let summaryText = 'Details';
      let bodyText = inner;
      if (summaryMatch) {
        summaryText = summaryMatch[1].trim();
        bodyText = inner.slice(summaryMatch[0].length).trim();
      }
      const children = parseNotionMarkdown(bodyText);
      blocks.push({
        type: 'details',
        summary: summaryText,
        summaryInlines: parseInlineSpans(summaryText),
        children,
      });
      cleaned = cleaned.slice(detailsMatch[0].length);
      continue;
    }

    // Check 5: Horizontal divider (--- or ***)
    const dividerMatch = cleaned.match(/^(?:---|[*]{3,})\s*(?:\r?\n|$)/);
    if (dividerMatch) {
      blocks.push({ type: 'divider' });
      cleaned = cleaned.slice(dividerMatch[0].length);
      continue;
    }

    // Check 6: Headings (# Heading)
    const headingMatch = cleaned.match(/^(#{1,6})\s+([^\r\n]+)(?:\r?\n|$)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      blocks.push({
        type: 'heading',
        level,
        text,
        inlines: parseInlineSpans(text),
      });
      cleaned = cleaned.slice(headingMatch[0].length);
      continue;
    }

    // Check 7: Blockquote (> quote)
    if (cleaned.startsWith('>')) {
      const quoteLines: string[] = [];
      const lines = cleaned.split(/\r?\n/);
      let consumedChars = 0;
      for (const line of lines) {
        if (line.startsWith('>')) {
          quoteLines.push(line.replace(/^>\s?/, ''));
          consumedChars += line.length + 1; // +1 for newline
        } else {
          break;
        }
      }
      const quoteText = quoteLines.join(' ').trim();
      if (quoteText) {
        blocks.push({
          type: 'blockquote',
          inlines: parseInlineSpans(quoteText),
        });
      }
      cleaned = cleaned.slice(Math.min(consumedChars, cleaned.length));
      continue;
    }

    // Check 8: List block (- item or 1. item)
    const listLineMatch = cleaned.match(/^(\s*)([-*]|\d+\.)\s+([^\r\n]+)/);
    if (listLineMatch) {
      const isOrdered = /^\d+\./.test(listLineMatch[2]);
      const items: ListItem[] = [];
      const lines = cleaned.split(/\r?\n/);
      let consumedChars = 0;

      for (const line of lines) {
        const itemMatch = isOrdered
          ? line.match(/^\s*\d+\.\s+([^\r\n]+)/)
          : line.match(/^\s*[-*]\s+([^\r\n]+)/);

        if (itemMatch) {
          items.push({
            inlines: parseInlineSpans(itemMatch[1].trim()),
          });
          consumedChars += line.length + 1;
        } else if (line.trim() === '') {
          // Empty line may end or continue list
          break;
        } else {
          break;
        }
      }

      if (items.length > 0) {
        blocks.push({
          type: 'list',
          ordered: isOrdered,
          items,
        });
      }
      cleaned = cleaned.slice(Math.min(consumedChars, cleaned.length));
      continue;
    }

    // Check 9: Fallback Paragraph
    // Collect lines until an empty line or a block starter is encountered
    const lines = cleaned.split(/\r?\n/);
    const paraLines: string[] = [];
    let consumedChars = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') {
        consumedChars += line.length + 1;
        break;
      }
      // If line starts a new block, stop paragraph
      if (
        line.startsWith('```') ||
        line.startsWith('<table') ||
        line.startsWith('<callout') ||
        line.startsWith('<details') ||
        /^#{1,6}\s+/.test(line) ||
        /^(?:---|[*]{3,})\s*$/.test(line) ||
        /^\s*[-*]\s+/.test(line) ||
        /^\s*\d+\.\s+/.test(line) ||
        line.startsWith('>')
      ) {
        if (paraLines.length > 0) {
          break;
        }
      }

      paraLines.push(line);
      consumedChars += line.length + 1;
    }

    const paraText = paraLines.join('\n').trim();
    if (paraText) {
      blocks.push({
        type: 'paragraph',
        inlines: parseInlineSpans(paraText),
      });
    }

    cleaned = cleaned.slice(Math.min(consumedChars, cleaned.length));
  }

  return blocks;
}
