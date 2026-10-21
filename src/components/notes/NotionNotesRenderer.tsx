import React, { useState, useMemo } from 'react';
import {
  parseNotionMarkdown,
  Block,
  InlineSpan,
  TableBlock,
  CalloutBlock,
  DetailsBlock,
  CodeBlock as CodeBlockType,
} from '../../lib/notionNotesParser';
import { ExternalLink, Copy, Check, ChevronRight } from 'lucide-react';

interface InlineSpansProps {
  spans: InlineSpan[];
}

export const InlineSpans: React.FC<InlineSpansProps> = ({ spans }) => {
  return (
    <>
      {spans.map((span, idx) => {
        switch (span.type) {
          case 'text':
            return <React.Fragment key={idx}>{span.text}</React.Fragment>;
          case 'bold':
            return (
              <strong key={idx} className="font-bold text-theme-text">
                <InlineSpans spans={span.children} />
              </strong>
            );
          case 'italic':
            return (
              <em key={idx} className="italic">
                <InlineSpans spans={span.children} />
              </em>
            );
          case 'code':
            return (
              <code
                key={idx}
                className="font-mono text-xs px-1.5 py-0.5 rounded bg-theme-surface-alt border border-theme-border text-theme-text font-medium select-all"
              >
                {span.code}
              </code>
            );
          case 'link':
            return (
              <a
                key={idx}
                href={span.url}
                target="_blank"
                rel="noreferrer"
                className="text-theme-accent hover:underline inline-flex items-center gap-1 font-medium"
              >
                <span>{span.text}</span>
                <ExternalLink className="w-3 h-3 inline flex-shrink-0" />
              </a>
            );
          case 'mention':
            return span.url ? (
              <a
                key={idx}
                href={span.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-theme-surface-alt hover:bg-theme-border/50 border border-theme-border text-theme-accent transition-colors font-sans mx-0.5"
              >
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                <span>{span.title || 'Notion Page'}</span>
              </a>
            ) : null;
          default:
            return null;
        }
      })}
    </>
  );
};

export const RenderTableBlock: React.FC<{ block: TableBlock }> = ({ block }) => {
  return (
    <div className="my-4 rounded-xl border border-theme-border overflow-hidden bg-theme-surface shadow-xs">
      <div className="overflow-x-auto no-scrollbar sm:scrollbar-thin">
        <table className="w-full text-left border-collapse text-sm">
          {block.headers && (
            <thead className="bg-theme-surface-alt border-b border-theme-border select-none">
              <tr>
                {block.headers.cells.map((cell, cIdx) => (
                  <th
                    key={cIdx}
                    className="px-3.5 py-2.5 text-xs font-bold text-theme-text tracking-wide whitespace-nowrap"
                  >
                    <InlineSpans spans={cell.inlines} />
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-theme-border/60">
            {block.rows.map((row, rIdx) => (
              <tr
                key={rIdx}
                className="hover:bg-theme-surface-alt/40 transition-colors"
              >
                {row.cells.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    className="px-3.5 py-2.5 align-top text-theme-text text-xs sm:text-sm leading-relaxed"
                  >
                    <InlineSpans spans={cell.inlines} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const RenderCalloutBlock: React.FC<{ block: CalloutBlock }> = ({ block }) => {
  return (
    <div className="my-3.5 p-4 rounded-xl border border-theme-border bg-theme-surface-alt/50 flex items-start gap-3 shadow-xs">
      <span className="text-xl flex-shrink-0 select-none leading-none pt-0.5" aria-hidden="true">
        {block.icon}
      </span>
      <div className="space-y-2 flex-1 text-sm leading-relaxed text-theme-text">
        <RenderBlockList blocks={block.children} />
      </div>
    </div>
  );
};

export const RenderDetailsBlock: React.FC<{ block: DetailsBlock }> = ({ block }) => {
  return (
    <details className="group my-3 rounded-xl border border-theme-border bg-theme-surface overflow-hidden transition-all duration-150">
      <summary className="px-4 py-3 bg-theme-surface-alt/40 hover:bg-theme-surface-alt cursor-pointer list-none flex items-center justify-between text-sm sm:text-[15px] font-semibold text-theme-text select-none">
        <div className="flex items-center gap-2 pr-2">
          <ChevronRight className="w-4 h-4 text-theme-accent transition-transform duration-200 group-open:rotate-90 flex-shrink-0" />
          <span className="leading-snug">
            <InlineSpans spans={block.summaryInlines} />
          </span>
        </div>
        <span className="text-[11px] font-normal text-theme-muted group-open:hidden whitespace-nowrap">
          Tap to view
        </span>
      </summary>
      <div className="p-4 border-t border-theme-border text-sm leading-relaxed space-y-3 bg-theme-surface">
        <RenderBlockList blocks={block.children} />
      </div>
    </details>
  );
};

export const RenderCodeBlock: React.FC<{ block: CodeBlockType }> = ({ block }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(block.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3.5 rounded-xl border border-theme-border overflow-hidden bg-stone-900 text-stone-100 dark:bg-black/60 shadow-xs">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-black/40 border-b border-stone-800 text-xs font-mono text-stone-400 select-none">
        <span className="text-[11px] uppercase tracking-wider text-stone-300 font-semibold">
          {block.language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy code to clipboard"
          className="flex items-center gap-1.5 hover:text-stone-100 transition-colors py-0.5 px-1.5 rounded hover:bg-white/10"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 text-[11px]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="text-[11px]">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-xs sm:text-[13px] font-mono leading-relaxed select-text no-scrollbar sm:scrollbar-thin">
        <code>{block.code}</code>
      </pre>
    </div>
  );
};

export const RenderBlockList: React.FC<{ blocks: Block[] }> = ({ blocks }) => {
  return (
    <>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading': {
            if (block.level === 1) {
              return (
                <h1
                  key={idx}
                  className="text-2xl font-extrabold text-theme-text mt-8 mb-3 pb-1 border-b border-theme-border"
                >
                  <InlineSpans spans={block.inlines} />
                </h1>
              );
            }
            if (block.level === 2) {
              return (
                <h2
                  key={idx}
                  className="text-xl font-bold text-theme-text mt-7 mb-2.5 pb-1 border-b border-theme-border/60"
                >
                  <InlineSpans spans={block.inlines} />
                </h2>
              );
            }
            if (block.level === 3) {
              return (
                <h3
                  key={idx}
                  className="text-base sm:text-lg font-semibold text-theme-text mt-5 mb-2"
                >
                  <InlineSpans spans={block.inlines} />
                </h3>
              );
            }
            return (
              <h4
                key={idx}
                className="text-sm sm:text-base font-semibold text-theme-text mt-4 mb-1.5"
              >
                <InlineSpans spans={block.inlines} />
              </h4>
            );
          }
          case 'table':
            return <RenderTableBlock key={idx} block={block} />;
          case 'callout':
            return <RenderCalloutBlock key={idx} block={block} />;
          case 'details':
            return <RenderDetailsBlock key={idx} block={block} />;
          case 'code':
            return <RenderCodeBlock key={idx} block={block} />;
          case 'list': {
            if (block.ordered) {
              return (
                <ol
                  key={idx}
                  className="my-2.5 space-y-1.5 pl-5 list-decimal text-sm leading-relaxed text-theme-text"
                >
                  {block.items.map((item, iIdx) => (
                    <li key={iIdx}>
                      <InlineSpans spans={item.inlines} />
                    </li>
                  ))}
                </ol>
              );
            }
            return (
              <ul
                key={idx}
                className="my-2.5 space-y-1.5 pl-5 list-disc text-sm leading-relaxed text-theme-text marker:text-theme-accent"
              >
                {block.items.map((item, iIdx) => (
                  <li key={iIdx}>
                    <InlineSpans spans={item.inlines} />
                  </li>
                ))}
              </ul>
            );
          }
          case 'blockquote':
            return (
              <blockquote
                key={idx}
                className="my-3 pl-3.5 border-l-4 border-theme-accent/60 italic text-sm text-theme-muted leading-relaxed"
              >
                <InlineSpans spans={block.inlines} />
              </blockquote>
            );
          case 'divider':
            return <hr key={idx} className="my-6 border-theme-border/80" />;
          case 'paragraph':
            return (
              <p
                key={idx}
                className="my-2 text-sm sm:text-[15px] leading-relaxed text-theme-text"
              >
                <InlineSpans spans={block.inlines} />
              </p>
            );
          default:
            return null;
        }
      })}
    </>
  );
};

export interface NotionNotesRendererProps {
  markdown: string;
}

export const NotionNotesRenderer: React.FC<NotionNotesRendererProps> = ({ markdown }) => {
  const blocks = useMemo(() => parseNotionMarkdown(markdown), [markdown]);

  if (blocks.length === 0) {
    return (
      <p className="text-theme-muted italic text-sm py-4 text-center">
        No content available in notes snapshot.
      </p>
    );
  }

  return (
    <div className="notion-notes-root space-y-1 select-text">
      <RenderBlockList blocks={blocks} />
    </div>
  );
};

export default NotionNotesRenderer;
