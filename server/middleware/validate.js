import { isValidDateString } from '../utils/dateUtils.js';
import { ALLOWED_CATEGORIES, normalizeCategory } from '../utils/exportUtils.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function ensurePlainObject(body, res) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    res.status(400).json({ error: 'Request body must be a valid JSON object.' });
    return false;
  }
  return true;
}

/**
 * Validates :id route parameter as a positive integer.
 */
export function validateHabitId(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      error: 'Invalid habit ID. Expected a positive integer.',
    });
  }
  req.habitId = id;
  return next();
}

/**
 * Validates POST / PUT habit payloads (name required, optional category & description).
 */
export function validateHabitPayload(req, res, next) {
  if (!ensurePlainObject(req.body, res)) return undefined;

  const rawName = req.body.name;
  const rawDescription = req.body.description ?? '';
  const normalizedCategory = normalizeCategory(req.body.category);

  if (typeof rawName !== 'string') {
    return res.status(400).json({
      error: 'Habit name is required and must be text.',
    });
  }

  const name = rawName.trim();
  if (name.length === 0) {
    return res.status(400).json({
      error: 'Habit name cannot be empty.',
    });
  }

  if (name.length > 100) {
    return res.status(400).json({
      error: 'Habit name must be 100 characters or fewer.',
    });
  }

  if (!normalizedCategory) {
    return res.status(400).json({
      error: `Invalid category. Allowed categories: ${ALLOWED_CATEGORIES.join(', ')}.`,
    });
  }

  if (typeof rawDescription !== 'string') {
    return res.status(400).json({
      error: 'Habit description must be text.',
    });
  }

  const description = rawDescription.trim();
  if (description.length > 300) {
    return res.status(400).json({
      error: 'Habit description must be 300 characters or fewer.',
    });
  }

  req.validatedHabit = {
    name,
    category: normalizedCategory,
    description,
  };
  return next();
}

/**
 * Validates user registration payload.
 */
export function validateRegisterPayload(req, res, next) {
  if (!ensurePlainObject(req.body, res)) return undefined;

  const rawName = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const rawEmail =
    typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const rawPassword = typeof req.body.password === 'string' ? req.body.password : '';
  const includeStarterHabits = Boolean(req.body.includeStarterHabits);

  if (rawName.length < 2 || rawName.length > 80) {
    return res.status(400).json({
      error: 'Full name must be between 2 and 80 characters.',
    });
  }

  if (!EMAIL_REGEX.test(rawEmail) || rawEmail.length > 160) {
    return res.status(400).json({
      error: 'Please enter a valid email address.',
    });
  }

  if (rawPassword.length < 8 || rawPassword.length > 128) {
    return res.status(400).json({
      error: 'Password must be between 8 and 128 characters.',
    });
  }

  req.validatedRegister = {
    name: rawName,
    email: rawEmail,
    password: rawPassword,
    includeStarterHabits,
  };
  return next();
}

/**
 * Validates user sign-in payload.
 */
export function validateLoginPayload(req, res, next) {
  if (!ensurePlainObject(req.body, res)) return undefined;

  const rawEmail =
    typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const rawPassword = typeof req.body.password === 'string' ? req.body.password : '';

  if (!rawEmail || !rawPassword || rawEmail.length > 160 || rawPassword.length > 128) {
    return res.status(400).json({
      error: 'Email and password are required.',
    });
  }

  req.validatedLogin = { email: rawEmail, password: rawPassword };
  return next();
}

/**
 * Validates profile name update payload.
 */
export function validateProfilePayload(req, res, next) {
  if (!ensurePlainObject(req.body, res)) return undefined;

  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({
      error: 'Display name must be between 2 and 80 characters.',
    });
  }

  req.validatedProfile = { name };
  return next();
}

/**
 * Validates password change payload.
 */
export function validatePasswordChangePayload(req, res, next) {
  if (!ensurePlainObject(req.body, res)) return undefined;

  const currentPassword =
    typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword =
    typeof req.body.newPassword === 'string' ? req.body.newPassword : '';

  if (!currentPassword) {
    return res.status(400).json({ error: 'Current password is required.' });
  }
  if (newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({
      error: 'New password must be between 8 and 128 characters.',
    });
  }

  req.validatedPasswordChange = { currentPassword, newPassword };
  return next();
}

/**
 * Validates JSON backup import payloads (`{ habits: [...] }` or `[...]`).
 */
export function validateImportPayload(req, res, next) {
  const rawList = Array.isArray(req.body) ? req.body : req.body?.habits;

  if (!Array.isArray(rawList) || rawList.length === 0) {
    return res.status(400).json({
      error: 'Import file must contain a non-empty "habits" array.',
    });
  }

  if (rawList.length > 200) {
    return res.status(400).json({
      error: 'Import is limited to at most 200 habits at once.',
    });
  }

  const sanitizedHabits = [];
  for (let i = 0; i < rawList.length; i += 1) {
    const item = rawList[i];
    if (!item || typeof item !== 'object') {
      return res.status(400).json({ error: `Habit entry at index ${i} is invalid.` });
    }

    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!name || name.length > 100) {
      return res.status(400).json({
        error: `Habit at index ${i} must have a valid name (1–100 chars).`,
      });
    }

    const category = normalizeCategory(item.category) || 'General';
    const description =
      typeof item.description === 'string' ? item.description.trim().slice(0, 300) : '';

    const rawDates = Array.isArray(item.completionDates) ? item.completionDates : [];
    const validDates = [
      ...new Set(rawDates.filter((d) => isValidDateString(d)).slice(0, 2000)),
    ];

    sanitizedHabits.push({
      name,
      category,
      description,
      completionDates: validDates,
    });
  }

  req.validatedImportHabits = sanitizedHabits;
  return next();
}
