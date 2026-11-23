import { Router } from 'express';
import {
  createHabit,
  deleteHabit,
  getHabits,
  toggleHabitCompletion,
  updateHabit,
} from '../controllers/habitController.js';
import { validateHabitId, validateHabitPayload } from '../middleware/validate.js';

const router = Router();

router.get('/', getHabits);
router.post('/', validateHabitPayload, createHabit);
router.put('/:id', validateHabitId, validateHabitPayload, updateHabit);
router.delete('/:id', validateHabitId, deleteHabit);
router.post('/:id/toggle', validateHabitId, toggleHabitCompletion);

export default router;
