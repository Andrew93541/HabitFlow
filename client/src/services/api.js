const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

/**
 * Formats the browser's current local calendar date as YYYY-MM-DD.
 */
export function getLocalTodayDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a YYYY-MM-DD string into a human-friendly display date.
 */
export function formatDisplayDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const localDate = new Date(year, month - 1, day);
  return localDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Shared fetch wrapper with credentials, CSRF header, and structured error handling.
 */
async function requestJson(endpoint, options = {}, { suppressUnauthorizedEvent = false } = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'HabitFlow',
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  }

  if (!response.ok) {
    if (response.status === 401 && !suppressUnauthorizedEvent && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('habitflow:unauthorized'));
    }
    const message = data?.error || `Request failed with status ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  return data;
}

/* ========================= Authentication & Account APIs ========================= */

export function fetchCurrentUser() {
  return requestJson('/auth/me', {}, { suppressUnauthorizedEvent: true });
}

export function registerAccount(
  { name, email, password, includeStarterHabits = true },
  localDate = getLocalTodayDateString()
) {
  return requestJson(
    '/auth/register',
    {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        password,
        includeStarterHabits,
        date: localDate,
      }),
    },
    { suppressUnauthorizedEvent: true }
  );
}

export function loginAccount({ email, password }) {
  return requestJson(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
    { suppressUnauthorizedEvent: true }
  );
}

export function loginDemoAccount(localDate = getLocalTodayDateString()) {
  return requestJson(
    '/auth/demo',
    {
      method: 'POST',
      body: JSON.stringify({ date: localDate }),
    },
    { suppressUnauthorizedEvent: true }
  );
}

export function logoutAccount() {
  return requestJson('/auth/logout', { method: 'POST' }, { suppressUnauthorizedEvent: true });
}

export function updateAccountProfile({ name }) {
  return requestJson('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export function changeAccountPassword({ currentPassword, newPassword }) {
  return requestJson(
    '/auth/password',
    {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    },
    { suppressUnauthorizedEvent: true }
  );
}

export function deleteAccountPermanent({ password }) {
  return requestJson(
    '/auth/account',
    {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    },
    { suppressUnauthorizedEvent: true }
  );
}

/* ============================ Habits & Dashboard APIs ============================ */

export function fetchHabits(localDate = getLocalTodayDateString()) {
  return requestJson(`/habits?date=${encodeURIComponent(localDate)}`);
}

export function fetchDashboardStats(localDate = getLocalTodayDateString()) {
  return requestJson(`/dashboard/stats?date=${encodeURIComponent(localDate)}`);
}

export function fetchHabitHistory(id, localDate = getLocalTodayDateString()) {
  return requestJson(`/habits/${id}/history?date=${encodeURIComponent(localDate)}`);
}

export function createHabit(
  { name, category = 'General', description = '' },
  localDate = getLocalTodayDateString()
) {
  return requestJson('/habits', {
    method: 'POST',
    body: JSON.stringify({ name, category, description, date: localDate }),
  });
}

export function updateHabit(
  id,
  { name, category = 'General', description = '' },
  localDate = getLocalTodayDateString()
) {
  return requestJson(`/habits/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, category, description, date: localDate }),
  });
}

export function deleteHabit(id) {
  return requestJson(`/habits/${id}`, {
    method: 'DELETE',
  });
}

export function toggleHabit(id, { date = getLocalTodayDateString(), completed } = {}) {
  return requestJson(`/habits/${id}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ date, completed }),
  });
}

export function importHabitsBackup(payload, localDate = getLocalTodayDateString()) {
  const habitsArray = Array.isArray(payload) ? payload : payload?.habits;
  return requestJson('/habits/import', {
    method: 'POST',
    body: JSON.stringify({ habits: habitsArray, date: localDate }),
  });
}

/**
 * Downloads habits & completion history as a CSV or JSON file.
 */
export async function downloadHabitsExport(
  format = 'csv',
  localDate = getLocalTodayDateString()
) {
  const normalizedFormat = format === 'json' ? 'json' : 'csv';
  const response = await fetch(
    `${API_BASE_URL}/habits/export?format=${normalizedFormat}&date=${encodeURIComponent(localDate)}`,
    {
      credentials: 'include',
      headers: {
        'X-Requested-With': 'HabitFlow',
      },
    }
  );

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('habitflow:unauthorized'));
    }
    let errorMessage = `Export failed with status ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson?.error) errorMessage = errJson.error;
    } catch {
      // Ignore JSON parse fallback errors
    }
    throw new Error(errorMessage);
  }

  const blob = await response.blob();
  const filename = `habitflow-export-${localDate}.${normalizedFormat}`;
  const objectUrl = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);

  return filename;
}
