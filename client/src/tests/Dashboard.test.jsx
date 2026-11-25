import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

describe('HabitFlow v2.0 Production UI: Auth, Multi-User Dashboard, Search/Sort & Heatmap', () => {
  let currentUser;
  let mockHabits;

  beforeEach(() => {
    currentUser = {
      id: 1,
      name: 'Alex Morgan',
      email: 'alex@example.com',
      isDemo: false,
    };

    mockHabits = [
      {
        id: 1,
        name: 'Morning Meditation',
        category: 'Mindfulness',
        description: '10 minutes mindfulness',
        completedToday: false,
        streak: 3,
        longestStreak: 5,
        totalCompletions: 8,
        recentHistory: [{ date: '2026-11-23', completed: false }],
      },
      {
        id: 2,
        name: 'Read 15 Pages',
        category: 'Study',
        description: 'Non-fiction chapter',
        completedToday: false,
        streak: 0,
        longestStreak: 2,
        totalCompletions: 2,
        recentHistory: [{ date: '2026-11-23', completed: false }],
      },
    ];

    URL.createObjectURL = vi.fn(() => 'blob:habitflow-export-test');
    URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();

    const computeStats = () => ({
      totalHabits: mockHabits.length,
      completedToday: mockHabits.filter((h) => h.completedToday).length,
      pendingToday: mockHabits.filter((h) => !h.completedToday).length,
      bestStreak: mockHabits.reduce((m, h) => Math.max(m, h.streak), 0),
    });

    global.fetch = vi.fn(async (url, options = {}) => {
      const method = options.method || 'GET';

      if (url.endsWith('/auth/me') && method === 'GET') {
        if (!currentUser) {
          return {
            ok: false,
            status: 401,
            headers: { get: () => 'application/json' },
            json: async () => ({ error: 'Authentication required.' }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ user: structuredClone(currentUser) }),
        };
      }

      if (url.endsWith('/auth/demo') && method === 'POST') {
        currentUser = {
          id: 99,
          name: 'Demo Explorer',
          email: 'demo@habitflow.local',
          isDemo: true,
        };
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ user: structuredClone(currentUser) }),
        };
      }

      if (url.endsWith('/auth/logout') && method === 'POST') {
        currentUser = null;
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ message: 'Signed out.' }),
        };
      }

      if (url.includes('/habits/export') && method === 'GET') {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'text/csv' },
          blob: async () =>
            new Blob(['Habit ID,Habit Name\n1,Morning Meditation'], { type: 'text/csv' }),
        };
      }

      if (/\/habits\/\d+\/history/.test(url) && method === 'GET') {
        const id = Number(url.match(/\/habits\/(\d+)\/history/)[1]);
        const target = mockHabits.find((h) => h.id === id);
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            habitId: target.id,
            name: target.name,
            category: target.category,
            streak: target.streak,
            longestStreak: target.longestStreak,
            totalCompletions: target.totalCompletions,
            completionDates: ['2026-11-20', '2026-11-21', '2026-11-22'],
          }),
        };
      }

      if (url.includes('/habits') && method === 'GET') {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => structuredClone(mockHabits),
        };
      }

      if (url.includes('/dashboard/stats') && method === 'GET') {
        return {
          ok: true,
          status: 200,
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
          status: 200,
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
          category: body.category || 'General',
          description: body.description,
          completedToday: false,
          streak: 0,
          longestStreak: 0,
          totalCompletions: 0,
          recentHistory: [],
        };
        mockHabits.push(created);
        return {
          ok: true,
          status: 201,
          headers: { get: () => 'application/json' },
          json: async () => structuredClone(created),
        };
      }

      if (/\/habits\/\d+$/.test(url) && method === 'DELETE') {
        const id = Number(url.match(/\/habits\/(\d+)$/)[1]);
        mockHabits = mockHabits.filter((h) => h.id !== id);
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ message: 'Deleted', id }),
        };
      }

      throw new Error(`Unhandled request: ${method} ${url}`);
    });
  });

  it('renders AuthPage when unauthenticated and supports 1-Click Instant Demo sign-in and sign-out', async () => {
    currentUser = null;
    const user = userEvent.setup();
    render(<App />);

    const demoBtn = await screen.findByTestId('demo-login-btn');
    expect(screen.getByText(/Small daily check-ins/i)).toBeInTheDocument();

    await user.click(demoBtn);

    expect(await screen.findByText('Morning Meditation')).toBeInTheDocument();
    expect(screen.getByText('Demo Explorer')).toBeInTheDocument();

    // Sign out returns to AuthPage
    await user.click(screen.getByTestId('sidebar-signout-btn'));
    expect(await screen.findByTestId('demo-login-btn')).toBeInTheDocument();
  });

  it('turns ONLY the checked habit text green, increments its streak by 1, and reverts cleanly when unchecked', async () => {
    const user = userEvent.setup();
    render(<App />);

    const habit1Title = await screen.findByTestId('habit-name-1');
    const habit2Title = screen.getByTestId('habit-name-2');

    expect(habit1Title).toHaveClass('text-slate-800');
    expect(habit1Title).not.toHaveClass('text-emerald-600');
    expect(screen.getByTestId('habit-streak-1')).toHaveTextContent('3 days');

    const checkbox1 = screen.getByRole('checkbox', {
      name: /Mark "Morning Meditation" as complete/i,
    });
    await user.click(checkbox1);

    await waitFor(() => {
      expect(screen.getByTestId('habit-name-1')).toHaveClass('text-emerald-600');
    });
    expect(screen.getByTestId('habit-status-1')).toHaveTextContent('Completed');
    expect(screen.getByTestId('habit-streak-1')).toHaveTextContent('4 days');

    // Habit 2 unaffected
    expect(habit2Title).toHaveClass('text-slate-800');
    expect(screen.getByTestId('habit-streak-2')).toHaveTextContent('0 days');

    // Uncheck Habit 1
    const uncheck1 = screen.getByRole('checkbox', {
      name: /Mark "Morning Meditation" as incomplete/i,
    });
    await user.click(uncheck1);

    await waitFor(() => {
      expect(screen.getByTestId('habit-name-1')).toHaveClass('text-slate-800');
    });
    expect(screen.getByTestId('habit-streak-1')).toHaveTextContent('3 days');
  });

  it('supports search, category filtering, adding categorized habits, and deleting with confirmation', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText('Morning Meditation');

    // Search filter
    const searchInput = screen.getByLabelText(/Search habits/i);
    await user.type(searchInput, 'Pages');
    expect(screen.getByText('Read 15 Pages')).toBeInTheDocument();
    expect(screen.queryByText('Morning Meditation')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Clear search/i }));

    // Category filter
    const categoryGroup = screen.getByRole('group', { name: /Filter habits by category/i });
    await user.click(within(categoryGroup).getByRole('button', { name: 'Study' }));
    expect(screen.getByText('Read 15 Pages')).toBeInTheDocument();
    expect(screen.queryByText('Morning Meditation')).not.toBeInTheDocument();
    await user.click(within(categoryGroup).getByRole('button', { name: 'All' }));

    // Add Habit
    await user.click(screen.getByRole('button', { name: /Add Habit/i }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Habit Name/i), 'Evening Stretching');
    await user.click(within(dialog).getByRole('radio', { name: 'Fitness' }));
    await user.click(within(dialog).getByRole('button', { name: /Create Habit/i }));

    expect(await screen.findByText('Evening Stretching')).toBeInTheDocument();
    expect(screen.getByTestId('habit-category-3')).toHaveTextContent('Fitness');

    // Delete with confirmation
    await user.click(screen.getByRole('button', { name: /Delete "Read 15 Pages"/i }));
    await user.click(screen.getByTestId('confirm-delete-btn'));

    await waitFor(() => {
      expect(screen.queryByText('Read 15 Pages')).not.toBeInTheDocument();
    });
  });

  it('opens the Monthly Calendar Heatmap modal, opens Mobile Drawer, and exports CSV history', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText('Morning Meditation');

    // Open Monthly Calendar Heatmap modal
    await user.click(
      screen.getByRole('button', { name: /View calendar heatmap for "Morning Meditation"/i })
    );
    const modal = await screen.findByRole('dialog');
    expect(await within(modal).findByTestId('calendar-longest-streak')).toHaveTextContent(
      '5 days'
    );
    await user.click(within(modal).getByRole('button', { name: /Close calendar modal/i }));

    // Open Mobile Navigation Drawer
    await user.click(screen.getByRole('button', { name: /Open navigation menu/i }));
    const drawer = screen.getByRole('dialog', { name: /Mobile navigation menu/i });
    expect(drawer).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: /Close navigation menu/i }));

    // Trigger CSV Export
    await user.click(screen.getByRole('button', { name: /Export habit history/i }));
    await user.click(screen.getByRole('menuitem', { name: /Export as CSV/i }));

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
    });
  });

  it('displays empty state when zero habits exist', async () => {
    mockHabits = [];
    render(<App />);

    expect(await screen.findByTestId('empty-habits-state')).toBeInTheDocument();
  });
});
