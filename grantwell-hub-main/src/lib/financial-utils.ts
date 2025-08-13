/**
 * Financial Utilities - Unified number formatting and parsing across the platform
 * These utilities ensure consistent handling of financial data throughout the application
 */

// Currency formatting with options
export const formatCurrency = (amount: number, options?: { 
  showCommas?: boolean; 
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}): string => {
  const { 
    showCommas = true, 
    minimumFractionDigits = 0, 
    maximumFractionDigits = 0 
  } = options || {};
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits,
    maximumFractionDigits
  }).format(amount || 0);
};

// Large number formatting for charts and summaries
export const formatLargeNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
};

// Number formatting with commas but no currency symbol
export const formatNumber = (amount: number): string => {
  return new Intl.NumberFormat('en-US').format(amount || 0);
};

// Parse numbers that may contain commas or currency symbols
export const parseNumberWithCommas = (value: string): number => {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  // Remove all non-numeric characters except decimal points
  const cleaned = value.toString().replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

// Format currency for chart tooltips
export const formatChartCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    notation: 'compact',
    compactDisplay: 'short'
  }).format(value);
};

// Real-time input formatting while preserving cursor position
export const formatInputValue = (input: HTMLInputElement, value: string): void => {
  const cursorPosition = input.selectionStart || 0;
  const numericValue = parseNumberWithCommas(value);
  const formattedValue = formatNumber(numericValue);
  
  input.value = formattedValue;
  
  // Restore cursor position accounting for added commas
  const diff = formattedValue.length - value.length;
  const newPosition = Math.max(0, cursorPosition + diff);
  input.setSelectionRange(newPosition, newPosition);
};

// Extract fiscal year from date or grant data
export const extractFiscalYear = (date: string | Date | null, fallback?: number): string => {
  if (!date) return fallback ? `FY${fallback.toString().slice(-2)}` : 'FY24';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const year = dateObj.getFullYear();
  
  // Federal fiscal year starts October 1st
  const fiscalYear = dateObj.getMonth() >= 9 ? year + 1 : year;
  return `FY${fiscalYear.toString().slice(-2)}`;
};

// Format grant name with fiscal year prefix
export const formatGrantNameWithFY = (grantTitle: string, startDate?: string | Date | null, fiscalYear?: number): string => {
  const fy = extractFiscalYear(startDate, fiscalYear);
  return `${fy} ${grantTitle}`;
};

// Utilization color helpers
export const getUtilizationColor = (utilization: number): { bg: string; text: string; border: string } => {
  if (utilization <= 75) return { bg: '#D1FAE5', text: '#059669', border: '#10B981' }; // Green
  if (utilization <= 90) return { bg: '#FEF3C7', text: '#D97706', border: '#F59E0B' }; // Amber
  return { bg: '#FEE2E2', text: '#DC2626', border: '#EF4444' }; // Red
};

export const getUtilizationTextColor = (utilization: number): string => {
  if (utilization <= 75) return 'text-green-600';
  if (utilization <= 95) return 'text-yellow-600';
  return 'text-red-600';
};

// Status badge colors
export const getStatusBadgeColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'high':
    case 'over-budget':
    case 'critical':
      return 'destructive';
    case 'medium':
    case 'pending':
    case 'warning':
      return 'default';
    case 'low':
    case 'on-track':
    case 'received':
    case 'good':
      return 'secondary';
    default:
      return 'default';
  }
};

// Chart color palettes
export const CHART_COLORS = [
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan  
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#6366F1', // Indigo
  '#84CC16'  // Lime
];

export const PASTEL_COLORS = {
  remaining: '#E0E7FF', // Light indigo
  spent: '#FEF3C7',     // Light amber
  budget: '#DBEAFE',    // Light blue
  risk: {
    low: '#D1FAE5',     // Light green
    medium: '#FEF3C7',  // Light amber
    high: '#FEE2E2'     // Light red
  }
};

// Grant shorthand generation
export const getGrantShorthand = (grantTitle: string): string => {
  const title = grantTitle.toLowerCase();
  
  if (title.includes('cops') || title.includes('community oriented policing')) return 'COPS';
  if (title.includes('jag') || title.includes('justice assistance')) return 'JAG';
  if (title.includes('voca') || title.includes('victims of crime')) return 'VOCA';
  if (title.includes('byrne') || title.includes('edward byrne')) return 'BYRNE';
  if (title.includes('vawa') || title.includes('violence against women')) return 'VAWA';
  if (title.includes('stop') || title.includes('services training')) return 'STOP';
  if (title.includes('bulletproof') || title.includes('vest')) return 'BVP';
  if (title.includes('scaap') || title.includes('criminal alien')) return 'SCAAP';
  if (title.includes('dui') || title.includes('driving under')) return 'DUI';
  if (title.includes('drug court') || title.includes('treatment court')) return 'DRUG CT';
  if (title.includes('mental health') || title.includes('mhc')) return 'MHC';
  if (title.includes('tribal') || title.includes('indian')) return 'TRIBAL';
  if (title.includes('teen') || title.includes('youth')) return 'YOUTH';
  if (title.includes('dna') || title.includes('forensic')) return 'DNA';
  if (title.includes('task force') || title.includes('taskforce')) return 'TASK FORCE';
  
  // If no match, create abbreviation from first letters of words
  const words = grantTitle.split(' ').filter(word => word.length > 2);
  if (words.length >= 2) {
    return words.slice(0, 3).map(word => word.charAt(0).toUpperCase()).join('');
  }
  
  // Fallback to first 8 characters
  return grantTitle.substring(0, 8).toUpperCase();
};

// Validation helpers
export const isValidCurrency = (value: string): boolean => {
  const parsed = parseNumberWithCommas(value);
  return !isNaN(parsed) && parsed >= 0;
};

export const validateBudgetAmount = (amount: string | number): { isValid: boolean; error?: string } => {
  const numAmount = typeof amount === 'string' ? parseNumberWithCommas(amount) : amount;
  
  if (isNaN(numAmount)) {
    return { isValid: false, error: 'Please enter a valid number' };
  }
  
  if (numAmount < 0) {
    return { isValid: false, error: 'Amount cannot be negative' };
  }
  
  if (numAmount > 100000000) { // $100M limit
    return { isValid: false, error: 'Amount exceeds maximum limit' };
  }
  
  return { isValid: true };
};