import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

describe('HabitFlow Dashboard UI & Core Assignment Requirements', () => {
  let mockHabits;

  beforeEach(() => {
    mockHabits = [
      {
        id: 1,
        name: 'Morning Meditation',
        description: '10 minutes mindfulness',
        completedToday: false,
        streak: 3,
        recentHistory: [{ date: '2026-11-23', completed: false }],
      },
      {
        id: 2,
        name: 'Read 15 Pages',
        description: 'Non-fiction chapter',
        completedToday: false,
        streak: 0,
        recentHistory: [{ date: '2026-11-23', completed: false }],
      },
    ];

    const computeStats = () => ({
      totalHabits: mockHabits.length,
      completedToday: mockHabits.filter((h) => h.completedToday).length,
      pendingToday: mockHabits.filter((h) => !h.completedToday).length,
      bestStreak: mockHabits.reduce((m, h) => Math.max(m, h.streak), 0),
    });

    global.fetch = vi.fn(async (url, options = {}) => {
      const method = options.method || 'GET';

      if (url.includes('/habits') && method === 'GET') {
        return {
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => structuredClone(mockHabits),
        };
      }

      if (url.includes('/dashboard/stats') && method === 'GET') {
        return {
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => computeStats(),
        };
      }

      if (url.endsWith('/toggle') && method === 'POST') {
        const id = Number(url.match(/\/habits\/(\d+)\/toggle/)[1]);
        const body = JSON.parse(options.body);
        mockHabits = mockHabits.map((h) => {
          if (h.id !== id) return h;
          const nextCompleted = body.completed ?? !h.completedToday;
          return {
            ...h,
            completedToday: nextCompleted,
            streak: nextCompleted ? h.streak + 1 : Math.max(0, h.streak - 1),
          };
        });
        const updatedHabit = mockHabits.find((h) => h.id === id);
        return {
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({
            habit: structuredClone(updatedHabit),
            stats: computeStats(),
          }),
        };
      }

      if (url.endsWith('/habits') && method === 'POST') {
        const body = JSON.parse(options.body);
        const created = {
          id: 3,
          name: body.name,
          description: body.description,
          completedToday: false,
          streak: 0,
          recentHistory: [],
        };
        mockHabits.push(created);
        return {
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => structuredClone(created),
        };
      }

      if (/\/habits\/\d+$/.test(url) && method === 'DELETE') {
        const id = Number(url.match(/\/habits\/(\d+)$/)[1]);
        mockHabits = mockHabits.filter((h) => h.id !== id);
        return {
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({ message: 'Deleted', id }),
        };
      }

      throw new Error(`Unhandled request: ${method} ${url}`);
    });
  });

  it('turns ONLY the checked habit text green, increments its streak by 1, and reverts cleanly when unchecked', async () => {
    const user = userEvent.setup();
    render(<App />);

    const habit1Title = await screen.findByTestId('habit-name-1');
    const habit2Title = screen.getByTestId('habit-name-2');

    // Initially neither habit has green text
    expect(habit1Title).toHaveClass('text-slate-800');
    expect(habit1Title).not.toHaveClass('text-emerald-600');
    expect(screen.getByTestId('habit-streak-1')).toHaveTextContent('3 days');
    expect(screen.getByTestId('habit-streak-2')).toHaveTextContent('0 days');

    // Check Habit 1 -> Habit 1 turns green and increments 3 -> 4; Habit 2 stays slate & 0
    const checkbox1 = screen.getByRole('checkbox', {
      name: /Mark "Morning Meditation" as complete/i,
    });
    await user.click(checkbox1);

    await waitFor(() => {
      expect(screen.getByTestId('habit-name-1')).toHaveClass('text-emerald-600');
    });
    expect(screen.getByTestId('habit-status-1')).toHaveTextContent('Completed');
    expect(screen.getByTestId('habit-streak-1')).toHaveTextContent('4 days');

    // Verify Habit 2 remained untouched
    expect(habit2Title).toHaveClass('text-slate-800');
    expect(habit2Title).not.toHaveClass('text-emerald-600');
    expect(screen.getByTestId('habit-streak-2')).toHaveTextContent('0 days');

    // Uncheck Habit 1 -> reverts from green to slate-800 and decrements 4 -> 3
    const uncheck1 = screen.getByRole('checkbox', {
      name: /Mark "Morning Meditation" as incomplete/i,
    });
    await user.click(uncheck1);

    await waitFor(() => {
      expect(screen.getByTestId('habit-name-1')).toHaveClass('text-slate-800');
    });
    expect(screen.getByTestId('habit-name-1')).not.toHaveClass('text-emerald-600');
    expect(screen.getByTestId('habit-streak-1')).toHaveTextContent('3 days');
  });

  it('supports adding a new habit and deleting a habit with confirmation', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText('Morning Meditation');

    // Open Add Habit modal
    await user.click(screen.getByRole('button', { name: /Add Habit/i }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Habit Name/i), 'Evening Journaling');
    await user.click(within(dialog).getByRole('button', { name: /Create Habit/i }));

    expect(await screen.findByText('Evening Journaling')).toBeInTheDocument();
    expect(screen.getByTestId('stat-value-total')).toHaveTextContent('3');

    // Delete with confirmation
    await user.click(screen.getByRole('button', { name: /Delete "Read 15 Pages"/i }));
    expect(screen.getByRole('dialog')).toHaveTextContent(/Are you sure you want to delete/i);
    await user.click(screen.getByTestId('confirm-delete-btn'));

    await waitFor(() => {
      expect(screen.queryByText('Read 15 Pages')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('stat-value-total')).toHaveTextContent('2');
  });

  it('displays empty state when zero habits exist', async () => {
    mockHabits = [];
    render(<App />);

    expect(await screen.findByTestId('empty-habits-state')).toBeInTheDocument();
    expect(screen.getByText(/No habits yet/i)).toBeInTheDocument();
  });
});
