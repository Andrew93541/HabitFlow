import { Router } from 'express';
import {
  createHabit,
  deleteHabit,
  exportHabitsData,
  getHabitHistory,
  getHabits,
  importHabitsData,
  toggleHabitCompletion,
  updateHabit,
} from '../controllers/habitController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  validateHabitId,
  validateHabitPayload,
  validateImportPayload,
} from '../middleware/validate.js';

const router = Router();

router.use(requireAuth);

router.get('/', getHabits);
router.get('/export', exportHabitsData);
router.post('/import', validateImportPayload, importHabitsData);
router.get('/:id/history', validateHabitId, getHabitHistory);
router.post('/', validateHabitPayload, createHabit);
router.put('/:id', validateHabitId, validateHabitPayload, updateHabit);
router.delete('/:id', validateHabitId, deleteHabit);
router.post('/:id/toggle', validateHabitId, toggleHabitCompletion);

export default router;
