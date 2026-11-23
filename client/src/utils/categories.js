export const HABIT_CATEGORIES = [
  'General',
  'Health',
  'Study',
  'Fitness',
  'Mindfulness',
  'Productivity',
];

export const CATEGORY_BADGE_STYLES = {
  General: 'bg-slate-100 text-slate-700 border-slate-200/80',
  Health: 'bg-teal-50 text-teal-700 border-teal-200/80',
  Study: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
  Fitness: 'bg-orange-50 text-orange-700 border-orange-200/80',
  Mindfulness: 'bg-violet-50 text-violet-700 border-violet-200/80',
  Productivity: 'bg-sky-50 text-sky-700 border-sky-200/80',
};

export function getCategoryBadgeClass(category) {
  return CATEGORY_BADGE_STYLES[category] || CATEGORY_BADGE_STYLES.General;
}
