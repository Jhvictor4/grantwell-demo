// [Grantwell Fix 2025-08-09]: Grant name shorthand + FY prefix utilities

export type GrantNameParts = { 
  fy?: string; 
  short: string; 
  full: string 
};

const FY_RE = /\bFY\s?(\d{2})\b/i;

function deriveFYFromMetadata(fullName: string, grantData?: { fiscal_year?: number; start_date?: string }): string | null {
  // Try to derive FY from grant metadata first
  if (grantData?.fiscal_year) {
    return `FY${grantData.fiscal_year.toString().slice(-2)}`;
  }
  
  // Try to derive from start_date if available
  if (grantData?.start_date) {
    const startDate = new Date(grantData.start_date);
    const year = startDate.getFullYear();
    const fiscalYear = startDate.getMonth() >= 9 ? year + 1 : year; // Federal FY starts Oct 1
    return `FY${fiscalYear.toString().slice(-2)}`;
  }
  
  // Fallback: try to extract from the name itself
  const match = fullName.match(FY_RE);
  if (match) {
    return `FY${match[1]}`;
  }
  
  // Last resort: use current fiscal year
  const now = new Date();
  const currentFY = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
  return `FY${currentFY.toString().slice(-2)}`;
}

export function normalizeSpaces(s: string): string {
  return (s || '').replace(/\s+/g, ' ').trim();
}

export function toGrantShorthand(
  fullName: string,
  grantDataOrFY?: { fiscal_year?: number; start_date?: string } | string | number
): GrantNameParts {
  const full = normalizeSpaces(fullName || '');

  // Determine FY: prefer existing FY in name, then provided fiscal year or metadata
  const existingFYMatch = full.match(FY_RE);
  let fy = existingFYMatch ? `FY${existingFYMatch[1]}` : '';

  if (!fy) {
    if (typeof grantDataOrFY === 'string' || typeof grantDataOrFY === 'number') {
      const fyStr = String(grantDataOrFY).slice(-2);
      fy = fyStr ? `FY${fyStr}` : '';
    } else {
      fy = deriveFYFromMetadata(full, grantDataOrFY) ?? '';
    }
  }

  // Canonical replacements (explicit mappings)
  let short = full
    // Edward Byrne → JAG
    .replace(/edward byrne memorial justice assistance grant program?/i, 'JAG')
    .replace(/byrne memorial justice assistance grant program?/i, 'JAG')
    .replace(/\bjustice assistance grant\b/i, 'JAG')

    // COPS programs → COPS
    .replace(/office of community oriented policing services|cops office/i, 'COPS')
    .replace(/community oriented policing services?/i, 'COPS')
    .replace(/\bcops\s+(hiring|technology|office|svpp|school violence prevention|anti[-\s]?violence|microgrants?|grant|program)\b.*?/i, 'COPS')

    // Cleanups
    .replace(/grant program/i, 'Program')
    .replace(/local solicitation/i, 'Local Program')
    .replace(/FY\s?\d{2,4}\s*/i, '') // remove any existing FY from short portion
  ;

  short = normalizeSpaces(short);

  // Construct final short name with FY prefix (no duplicate FY)
  const label = fy ? `${fy} ${short}` : short;

  return { fy, short: label, full };
}