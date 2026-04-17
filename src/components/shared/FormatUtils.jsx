export function formatNOK(amount) {
  const num = Number(amount);
  if (isNaN(num)) return '0 kr';
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  // Parse as local date to avoid timezone shift (yyyy-MM-dd strings)
  const [y, m, d] = String(dateStr).split('T')[0].split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatPercent(value, total) {
  if (!total || total === 0) return '0 %';
  return `${Math.round((value / total) * 100)} %`;
}

// Norwegian VAT rates
export const VAT_RATES = [
  { label: '25 % (standard)', value: 0.25 },
  { label: '15 % (matvarer)', value: 0.15 },
  { label: '12 % (persontransport)', value: 0.12 },
  { label: '0 % (momsfri)', value: 0 },
];

export function calcAmountExVat(amountInclVat, vatRate) {
  if (!vatRate) return Number(amountInclVat);
  return Number(amountInclVat) / (1 + vatRate);
}

export function calcVatAmount(amountInclVat, vatRate) {
  if (!vatRate) return 0;
  return Number(amountInclVat) - calcAmountExVat(amountInclVat, vatRate);
}

export const INCOME_CATEGORIES = [
  'Kontingent', 'Sponsorinntekter', 'Dugnad', 'Tilskudd', 'Kiosksalg',
  'Gaver og donasjoner', 'Cuper og turneringer', 'Andre inntekter',
];
export const EXPENSE_CATEGORIES = [
  'Utstyr og materiell', 'Dommer og funksjonærer', 'Reise og transport',
  'Leie av lokaler/bane', 'Arrangement', 'Administrasjon', 'Treningskostnader',
  'Forsikring', 'Cuper og turneringer', 'Andre utgifter',
];
export const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

export function getCategoryType(category) {
  return INCOME_CATEGORIES.includes(category) ? 'income' : 'expense';
}

// Norwegian role labels
export const ROLE_LABELS = {
  admin: 'Administrator',
  kasserer: 'Kasserer',
  styreleder: 'Styreleder',
  revisor: 'Revisor',
  forelder: 'Forelder',
  player: 'Spiller',
  viewer: 'Lesetilgang',
};

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || role;
}