import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from './Sidebar';

describe('Sidebar timeline', () => {
  it('marks the active day with a single rail node', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/stage/s6-queues-async/day/38']}>
        <Sidebar />
      </MemoryRouter>
    );

    const activeDay = screen.getByRole('link', { name: /Kafka fundamentals/i });

    expect(activeDay).toHaveAttribute('aria-current', 'page');
    expect(container.querySelectorAll('.sidebar-timeline-node')).toHaveLength(1);
    expect(
      activeDay.closest('.sidebar-timeline')?.querySelector('.sidebar-timeline-node')
    ).not.toBeNull();
  });

  it('does not render a rail node without an active day', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/stage/s6-queues-async']}>
        <Sidebar />
      </MemoryRouter>
    );

    expect(container.querySelector('.sidebar-timeline-node')).toBeNull();
  });
});
