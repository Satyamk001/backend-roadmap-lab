import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from './Sidebar';

const renderSidebar = (path: string, isMobileOpen = false, onCloseMobile = vi.fn()) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar isMobileOpen={isMobileOpen} onCloseMobile={onCloseMobile} />
    </MemoryRouter>
  );

describe('Sidebar timeline', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.body.style.overflow = '';
  });

  afterEach(() => {
    window.localStorage.clear();
    document.body.style.overflow = '';
  });

  it('marks the active day with a single rail node', () => {
    const { container } = renderSidebar('/stage/s6-queues-async/day/38');

    const activeDay = screen.getByRole('link', { name: /Kafka fundamentals/i });

    expect(activeDay).toHaveAttribute('aria-current', 'page');
    expect(container.querySelectorAll('.sidebar-timeline-node')).toHaveLength(1);
    expect(
      activeDay.closest('.sidebar-timeline')?.querySelector('.sidebar-timeline-node')
    ).not.toBeNull();
  });

  it('does not render a rail node without an active day', () => {
    const { container } = renderSidebar('/stage/s6-queues-async');

    expect(container.querySelector('.sidebar-timeline-node')).toBeNull();
  });

  it('keeps the current day visible when its stage is collapsed', () => {
    renderSidebar('/stage/s6-queues-async/day/38');

    const stageButton = screen.getByRole('button', {
      name: /Queues & Async Processing/i,
    });

    expect(stageButton).toHaveAttribute('aria-expanded', 'true');
    const controlsId = stageButton.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();
    expect(document.getElementById(controlsId as string)).not.toBeNull();

    fireEvent.click(stageButton);

    expect(screen.queryByRole('link', { name: /Kafka fundamentals/i })).toBeNull();
    expect(
      screen.getByRole('button', { name: /Queues & Async Processing/i })
    ).toHaveTextContent('Day 38');
    expect(
      screen.getByRole('button', { name: /Queues & Async Processing/i })
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the last visited stage on the index page', () => {
    window.localStorage.setItem('backend_lab_last_stage', 's6-queues-async');

    renderSidebar('/');

    expect(
      screen.getByRole('link', { name: /Kafka fundamentals/i })
    ).toBeInTheDocument();
  });

  it('falls back to the first stage when storage is empty', () => {
    renderSidebar('/');

    expect(
      screen.getByRole('link', { name: /Event loop phases/i })
    ).toBeInTheDocument();
  });
});

describe('Sidebar mobile drawer', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.body.style.overflow = '';
  });

  afterEach(() => {
    window.localStorage.clear();
    document.body.style.overflow = '';
  });

  it('exposes a named modal dialog and locks background scroll', () => {
    renderSidebar('/stage/s6-queues-async/day/38', true);

    const dialog = screen.getByRole('dialog', { name: 'Roadmap navigation' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(
      within(dialog).getByRole('button', { name: /close navigation menu/i })
    ).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('closes on Escape and restores body scroll', () => {
    const onCloseMobile = vi.fn();
    const { rerender } = render(
      <MemoryRouter initialEntries={['/stage/s6-queues-async/day/38']}>
        <Sidebar isMobileOpen onCloseMobile={onCloseMobile} />
      </MemoryRouter>
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCloseMobile).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter initialEntries={['/stage/s6-queues-async/day/38']}>
        <Sidebar isMobileOpen={false} onCloseMobile={onCloseMobile} />
      </MemoryRouter>
    );
    expect(document.body.style.overflow).toBe('');
  });

  it('traps Tab inside the drawer', () => {
    renderSidebar('/stage/s6-queues-async/day/38', true);

    const dialog = screen.getByRole('dialog', { name: 'Roadmap navigation' });
    const closeButton = within(dialog).getByRole('button', {
      name: /close navigation menu/i,
    });
    const links = within(dialog).getAllByRole('link');
    const lastLink = links[links.length - 1];

    lastLink.focus();
    fireEvent.keyDown(lastLink, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true });
    expect(lastLink).toHaveFocus();
  });

  it('returns focus to the trigger when the drawer closes', () => {
    const onCloseMobile = vi.fn();
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.textContent = 'Open navigation';
    trigger.setAttribute('data-sidebar-trigger', '');
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(
      <MemoryRouter initialEntries={['/stage/s6-queues-async/day/38']}>
        <Sidebar onCloseMobile={onCloseMobile} />
      </MemoryRouter>
    );

    rerender(
      <MemoryRouter initialEntries={['/stage/s6-queues-async/day/38']}>
        <Sidebar isMobileOpen onCloseMobile={onCloseMobile} />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('button', { name: /close navigation menu/i })
    ).toHaveFocus();

    rerender(
      <MemoryRouter initialEntries={['/stage/s6-queues-async/day/38']}>
        <Sidebar onCloseMobile={onCloseMobile} />
      </MemoryRouter>
    );

    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});
