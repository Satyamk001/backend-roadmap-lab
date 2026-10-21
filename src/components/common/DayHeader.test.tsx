import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DayHeader } from './DayHeader';
import { DayMeta } from '../../types/content';

describe('DayHeader Component', () => {
  const mockDay: DayMeta = {
    dayNumber: 22,
    title: 'Redis Data Structures & Persistence',
    stageId: 's4-caching-redis',
    trackerTask: 'Redis data structures & persistence',
    definition: 'In-memory key-value data store providing sub-millisecond operations.',
    keyPoints: [
      {
        icon: '⚡',
        title: 'In-Memory Structures',
        description: 'Strings, Hashes, Lists, Sets & ZSets in volatile RAM.',
      },
      {
        icon: '⏱️',
        title: 'TTL & Eviction',
        description: 'Key expiration and memory eviction policies.',
      },
      {
        icon: '💾',
        title: 'Dual Persistence',
        description: 'RDB snapshots + AOF continuous append-log.',
      },
    ],
    recap: 'Detailed Hinglish narrative recap about Redis RAM operations and durability.',
    concepts: ['Strings', 'Hashes', 'Persistence'],
    demos: [],
    notesUrl: 'https://notion.so/test',
    notionPageId: 'test-id',
    lastSynced: '2026-10-21',
    status: 'ready',
  };

  it('renders title and 1-line definition prominently', () => {
    render(<DayHeader day={mockDay} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Day 22: Redis Data Structures & Persistence'
    );
    expect(
      screen.getByText('In-memory key-value data store providing sub-millisecond operations.')
    ).toBeInTheDocument();
  });

  it('renders all 3 key takeaway cards with icons and descriptions', () => {
    render(<DayHeader day={mockDay} />);

    expect(screen.getByText('In-Memory Structures')).toBeInTheDocument();
    expect(
      screen.getByText('Strings, Hashes, Lists, Sets & ZSets in volatile RAM.')
    ).toBeInTheDocument();

    expect(screen.getByText('TTL & Eviction')).toBeInTheDocument();
    expect(screen.getByText('Dual Persistence')).toBeInTheDocument();
  });

  it('toggles detailed narrative recap when clicked', () => {
    render(<DayHeader day={mockDay} />);

    const toggleButton = screen.getByRole('button', {
      name: /read detailed narrative recap/i,
    });
    expect(toggleButton).toBeInTheDocument();

    // Recap initially collapsed
    expect(
      screen.queryByText('Detailed Hinglish narrative recap about Redis RAM operations and durability.')
    ).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(toggleButton);
    expect(
      screen.getByText('Detailed Hinglish narrative recap about Redis RAM operations and durability.')
    ).toBeInTheDocument();

    // Click to hide
    fireEvent.click(
      screen.getByRole('button', { name: /hide detailed narrative recap/i })
    );
    expect(
      screen.queryByText('Detailed Hinglish narrative recap about Redis RAM operations and durability.')
    ).not.toBeInTheDocument();
  });

  it('falls back to demo summaries if keyPoints are not explicitly provided', () => {
    const dayWithoutKeyPoints: DayMeta = {
      ...mockDay,
      definition: undefined,
      keyPoints: undefined,
      demos: [
        {
          id: 'demo-1',
          title: 'Demo One Title',
          summary: 'Summary of Demo One',
          difficulty: 'easy',
          notesAnchor: 'anchor-1',
        },
      ],
    };

    render(<DayHeader day={dayWithoutKeyPoints} />);

    expect(screen.getByText('Demo One Title')).toBeInTheDocument();
    expect(screen.getByText('Summary of Demo One')).toBeInTheDocument();
  });
});
