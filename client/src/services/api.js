const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

/**
 * Formats the browser's current local calendar date as YYYY-MM-DD.
 * Prevents UTC midnight timezone mismatches between browser and server.
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
 * Shared fetch wrapper with JSON parsing and friendly error handling.
 */
async function requestJson(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
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
    const message = data?.error || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export function fetchHabits(localDate = getLocalTodayDateString()) {
  return requestJson(`/habits?date=${encodeURIComponent(localDate)}`);
}

export function fetchDashboardStats(localDate = getLocalTodayDateString()) {
  return requestJson(`/dashboard/stats?date=${encodeURIComponent(localDate)}`);
}

export function createHabit({ name, description = '' }, localDate = getLocalTodayDateString()) {
  return requestJson('/habits', {
    method: 'POST',
    body: JSON.stringify({ name, description, date: localDate }),
  });
}

export function updateHabit(id, { name, description = '' }, localDate = getLocalTodayDateString()) {
  return requestJson(`/habits/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, description, date: localDate }),
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
