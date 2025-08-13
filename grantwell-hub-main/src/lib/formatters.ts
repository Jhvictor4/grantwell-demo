// [Grantwell Fix 2025-08-09]: Global currency/percent formatters for consistent display

export const fmtCurrency = (n: number): string => {
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD', 
    maximumFractionDigits: 0 
  }).format(n);
};

export const fmtCurrencyWithCents = (n: number): string => {
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD', 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  }).format(n);
};

export const fmtPercent2 = (n: number): string => {
  return `${(Number.isFinite(n) ? n : 0).toFixed(2)}%`;
};

export const toNumber = (v: string | number): number => {
  return Number(String(v).replace(/,/g, ''));
};