const RATES = { USD: 1, EUR: 0.92, GBP: 0.79, CAD: 1.36, AUD: 1.52 };
const SYMBOL = { USD: '$', EUR: '€', GBP: '£', CAD: 'C$', AUD: 'A$' };

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

export function currencySymbol(code) {
  return SYMBOL[code] || '$';
}

export function getGlobalCurrency() {
  return localStorage.getItem('kindred_currency') || 'USD';
}

export function setGlobalCurrency(c) {
  localStorage.setItem('kindred_currency', c);
}

export function convert(amount, fromCurrency) {
  const from = RATES[fromCurrency] || 1;
  const to = RATES[getGlobalCurrency()] || 1;
  return (Number(amount || 0) / from) * to;
}

export function formatMoney(amount, fromCurrency) {
  const val = convert(amount, fromCurrency);
  return `${currencySymbol(getGlobalCurrency())}${Math.round(val).toLocaleString()}`;
}

export function formatGlobal(value) {
  return `${currencySymbol(getGlobalCurrency())}${Math.round(Number(value || 0)).toLocaleString()}`;
}