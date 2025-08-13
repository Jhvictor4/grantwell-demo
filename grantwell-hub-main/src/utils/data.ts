// [Grantwell Fix 2025-08-09]: Data de-duplication and aggregation utilities

export function uniqueByGrantId<T extends { grant_id: string | number }>(rows: T[]): T[] {
  const seen = new Set();
  return rows.filter(r => {
    if (seen.has(r.grant_id)) {
      return false;
    }
    seen.add(r.grant_id);
    return true;
  });
}

// For charts that need to sum amounts by grant_id
export function sumByGrantId(rows: {grant_id: any, amount: number}[]): Array<{grant_id: any, total: number}> {
  const map = new Map<any, number>();
  rows.forEach(r => {
    const currentTotal = map.get(r.grant_id) || 0;
    const amount = Number(r.amount) || 0;
    map.set(r.grant_id, currentTotal + amount);
  });
  return Array.from(map, ([grant_id, total]) => ({ grant_id, total }));
}

// For budget data aggregation by grant and category
export function aggregateBudgetByGrantCategory<T extends { 
  grant_id: any, 
  category: string, 
  budgeted?: number, 
  actual?: number,
  spent?: number 
}>(rows: T[]): Array<T & { budgeted: number, actual: number }> {
  const map = new Map<string, T & { budgeted: number, actual: number }>();
  
  rows.forEach(row => {
    const key = `${row.grant_id}-${row.category}`;
    const existing = map.get(key);
    const budgeted = Number(row.budgeted) || 0;
    const actual = Number(row.actual || row.spent) || 0;
    
    if (existing) {
      existing.budgeted += budgeted;
      existing.actual += actual;
    } else {
      map.set(key, {
        ...row,
        budgeted,
        actual
      });
    }
  });
  
  return Array.from(map.values());
}

// Deduplicate grants while preserving the most complete data
export function deduplicateGrants<T extends { 
  id: string, 
  title: string,
  [key: string]: any 
}>(grants: T[]): T[] {
  const map = new Map<string, T>();
  
  grants.forEach(grant => {
    const existing = map.get(grant.id);
    if (!existing) {
      map.set(grant.id, grant);
    } else {
      // Keep the grant with more complete data (more non-null fields)
      const existingFields = Object.values(existing).filter(v => v != null).length;
      const currentFields = Object.values(grant).filter(v => v != null).length;
      if (currentFields > existingFields) {
        map.set(grant.id, grant);
      }
    }
  });
  
  return Array.from(map.values());
}
