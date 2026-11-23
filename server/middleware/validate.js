import { ALLOWED_CATEGORIES, normalizeCategory } from '../utils/exportUtils.js';

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
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({
      error: 'Request body must be a valid JSON object.',
    });
  }

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
