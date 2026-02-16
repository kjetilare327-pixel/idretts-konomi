export function formatNOK(amount) {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export const INCOME_CATEGORIES = ['Kontingent', 'Sponsor', 'Kiosk', 'Gaver', 'Dugnad'];
export const EXPENSE_CATEGORIES = ['Utstyr', 'Dommer', 'Reise', 'Arrangement', 'Diverse'];
export const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

export function getCategoryType(category) {
  return INCOME_CATEGORIES.includes(category) ? 'income' : 'expense';
}