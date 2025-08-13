/**
 * ERP Export Service - Standardized CSV exports for municipal ERP systems
 * Supports Munis, Tyler, and other municipal financial systems
 */

export interface BudgetExportData {
  id: string;
  grantId: string;
  grantTitle: string;
  category: string;
  itemName: string;
  description?: string;
  budgetedAmount: number;
  allocatedAmount: number;
  spentAmount: number;
  fiscalYear: number;
  quarter?: number;
  tags?: string;
  vendor?: string;
  lastUpdated: string;
}

export interface ExpenseExportData {
  id: string;
  grantId: string;
  grantTitle: string;
  amount: number;
  date: string;
  description: string;
  vendor?: string;
  invoiceNumber?: string;
  approvalStatus: string;
  category?: string;
  budgetLineItemId?: string;
}

export type ERPFormat = 'munis' | 'tyler' | 'generic' | 'quickbooks';

export interface ExportOptions {
  format: ERPFormat;
  includeHeaders: boolean;
  dateFormat: 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'DD/MM/YYYY';
  currencyFormat: 'USD' | 'numeric';
  fiscalYear?: number;
  quarter?: number;
  grantIds?: string[];
}

export class ERPExportService {
  /**
   * Export budget data in specified ERP format
   */
  static exportBudgetData(data: BudgetExportData[], options: ExportOptions): string {
    switch (options.format) {
      case 'munis':
        return this.exportMunisFormat(data, options);
      case 'tyler':
        return this.exportTylerFormat(data, options);
      case 'quickbooks':
        return this.exportQuickBooksFormat(data, options);
      default:
        return this.exportGenericFormat(data, options);
    }
  }

  /**
   * Export expense data in specified ERP format
   */
  static exportExpenseData(data: ExpenseExportData[], options: ExportOptions): string {
    switch (options.format) {
      case 'munis':
        return this.exportMunisExpenses(data, options);
      case 'tyler':
        return this.exportTylerExpenses(data, options);
      case 'quickbooks':
        return this.exportQuickBooksExpenses(data, options);
      default:
        return this.exportGenericExpenses(data, options);
    }
  }

  /**
   * Munis ERP Budget Format
   * Standard format used by Tyler Munis financial systems
   */
  private static exportMunisFormat(data: BudgetExportData[], options: ExportOptions): string {
    const headers = [
      'Fund',
      'Department', 
      'Account',
      'Project',
      'Description',
      'Budgeted_Amount',
      'YTD_Actual',
      'Encumbered',
      'Available',
      'Fiscal_Year',
      'Last_Updated'
    ];

    const rows = data.map(item => [
      this.extractFundCode(item.grantId), // Fund from grant ID
      this.mapCategoryToDepartment(item.category), // Department mapping
      this.mapCategoryToAccount(item.category), // Account code mapping
      item.grantId.substring(0, 8), // Project code
      `"${item.itemName}"`,
      this.formatCurrency(item.budgetedAmount, options.currencyFormat),
      this.formatCurrency(item.spentAmount, options.currencyFormat),
      this.formatCurrency(item.allocatedAmount - item.spentAmount, options.currencyFormat),
      this.formatCurrency(item.budgetedAmount - item.spentAmount, options.currencyFormat),
      item.fiscalYear,
      this.formatDate(item.lastUpdated, options.dateFormat)
    ]);

    return this.buildCSV(headers, rows.map(row => row.map(String)), options.includeHeaders);
  }

  /**
   * Tyler ERP Budget Format
   * Standard format for Tyler Technologies ERP systems
   */
  private static exportTylerFormat(data: BudgetExportData[], options: ExportOptions): string {
    const headers = [
      'Entity',
      'Fund_Code',
      'Dept_Code',
      'Account_Code',
      'Grant_ID',
      'Line_Description',
      'Original_Budget',
      'Current_Budget', 
      'YTD_Expenditures',
      'Encumbrances',
      'Budget_Balance',
      'Fiscal_Year',
      'Period'
    ];

    const rows = data.map(item => [
      '001', // Default entity
      this.extractFundCode(item.grantId),
      this.mapCategoryToDepartment(item.category),
      this.mapCategoryToAccount(item.category),
      `"${item.grantId}"`,
      `"${item.itemName}"`,
      this.formatCurrency(item.budgetedAmount, options.currencyFormat),
      this.formatCurrency(item.allocatedAmount, options.currencyFormat),
      this.formatCurrency(item.spentAmount, options.currencyFormat),
      this.formatCurrency(Math.max(0, item.allocatedAmount - item.spentAmount), options.currencyFormat),
      this.formatCurrency(item.budgetedAmount - item.spentAmount, options.currencyFormat),
      item.fiscalYear,
      item.quarter || 1
    ]);

    return this.buildCSV(headers, rows.map(row => row.map(String)), options.includeHeaders);
  }

  /**
   * QuickBooks Format
   * Standard chart of accounts format
   */
  private static exportQuickBooksFormat(data: BudgetExportData[], options: ExportOptions): string {
    const headers = [
      'Account',
      'Account_Type',
      'Detail_Type',
      'Name',
      'Description',
      'Budget_Amount',
      'Actual_Amount',
      'Class',
      'Location'
    ];

    const rows = data.map(item => [
      this.mapCategoryToQBAccount(item.category),
      'Expense',
      this.mapCategoryToQBDetailType(item.category),
      `"${item.itemName}"`,
      `"${item.description || item.itemName}"`,
      this.formatCurrency(item.budgetedAmount, options.currencyFormat),
      this.formatCurrency(item.spentAmount, options.currencyFormat),
      `"${item.grantTitle}"`,
      this.mapCategoryToDepartment(item.category)
    ]);

    return this.buildCSV(headers, rows, options.includeHeaders);
  }

  /**
   * Generic CSV format for other systems
   */
  private static exportGenericFormat(data: BudgetExportData[], options: ExportOptions): string {
    const headers = [
      'Grant_ID',
      'Grant_Title',
      'Category',
      'Item_Name',
      'Description',
      'Budgeted_Amount',
      'Allocated_Amount',
      'Spent_Amount',
      'Remaining_Amount',
      'Fiscal_Year',
      'Quarter',
      'Tags',
      'Last_Updated'
    ];

    const rows = data.map(item => [
      `"${item.grantId}"`,
      `"${item.grantTitle}"`,
      `"${item.category}"`,
      `"${item.itemName}"`,
      `"${item.description || ''}"`,
      this.formatCurrency(item.budgetedAmount, options.currencyFormat),
      this.formatCurrency(item.allocatedAmount, options.currencyFormat),
      this.formatCurrency(item.spentAmount, options.currencyFormat),
      this.formatCurrency(item.budgetedAmount - item.spentAmount, options.currencyFormat),
      item.fiscalYear,
      item.quarter || '',
      `"${item.tags || ''}"`,
      this.formatDate(item.lastUpdated, options.dateFormat)
    ]);

    return this.buildCSV(headers, rows.map(row => row.map(String)), options.includeHeaders);
  }

  /**
   * Munis Expense Export Format
   */
  private static exportMunisExpenses(data: ExpenseExportData[], options: ExportOptions): string {
    const headers = [
      'Voucher_Number',
      'Vendor',
      'Invoice_Number',
      'Invoice_Date',
      'Description',
      'Amount',
      'Fund',
      'Department',
      'Account',
      'Project',
      'Approval_Status'
    ];

    const rows = data.map(item => [
      item.id.substring(0, 10),
      `"${item.vendor || 'Unknown'}"`,
      `"${item.invoiceNumber || ''}"`,
      this.formatDate(item.date, options.dateFormat),
      `"${item.description}"`,
      this.formatCurrency(item.amount, options.currencyFormat),
      this.extractFundCode(item.grantId),
      this.mapCategoryToDepartment(item.category || 'Other'),
      this.mapCategoryToAccount(item.category || 'Other'),
      item.grantId.substring(0, 8),
      item.approvalStatus.toUpperCase()
    ]);

    return this.buildCSV(headers, rows, options.includeHeaders);
  }

  /**
   * Tyler Expense Export Format
   */
  private static exportTylerExpenses(data: ExpenseExportData[], options: ExportOptions): string {
    const headers = [
      'Transaction_ID',
      'Entity',
      'Fund_Code',
      'Dept_Code',
      'Account_Code',
      'Vendor_ID',
      'Invoice_Number',
      'Transaction_Date',
      'Amount',
      'Description',
      'Reference',
      'Status'
    ];

    const rows = data.map(item => [
      item.id,
      '001',
      this.extractFundCode(item.grantId),
      this.mapCategoryToDepartment(item.category || 'Other'),
      this.mapCategoryToAccount(item.category || 'Other'),
      `"${item.vendor || 'TBD'}"`,
      `"${item.invoiceNumber || ''}"`,
      this.formatDate(item.date, options.dateFormat),
      this.formatCurrency(item.amount, options.currencyFormat),
      `"${item.description}"`,
      `"${item.grantTitle}"`,
      item.approvalStatus.toUpperCase()
    ]);

    return this.buildCSV(headers, rows, options.includeHeaders);
  }

  /**
   * QuickBooks Expense Export Format
   */
  private static exportQuickBooksExpenses(data: ExpenseExportData[], options: ExportOptions): string {
    const headers = [
      'Date',
      'Account',
      'Vendor',
      'Amount',
      'Description',
      'Ref_No',
      'Class',
      'Billable'
    ];

    const rows = data.map(item => [
      this.formatDate(item.date, options.dateFormat),
      this.mapCategoryToQBAccount(item.category || 'Other'),
      `"${item.vendor || 'Unknown'}"`,
      this.formatCurrency(item.amount, options.currencyFormat),
      `"${item.description}"`,
      `"${item.invoiceNumber || ''}"`,
      `"${item.grantTitle}"`,
      'No'
    ]);

    return this.buildCSV(headers, rows, options.includeHeaders);
  }

  /**
   * Generic Expense Export Format
   */
  private static exportGenericExpenses(data: ExpenseExportData[], options: ExportOptions): string {
    const headers = [
      'Expense_ID',
      'Grant_ID',
      'Grant_Title',
      'Date',
      'Amount',
      'Description',
      'Vendor',
      'Invoice_Number',
      'Category',
      'Approval_Status',
      'Budget_Line_Item_ID'
    ];

    const rows = data.map(item => [
      item.id,
      `"${item.grantId}"`,
      `"${item.grantTitle}"`,
      this.formatDate(item.date, options.dateFormat),
      this.formatCurrency(item.amount, options.currencyFormat),
      `"${item.description}"`,
      `"${item.vendor || ''}"`,
      `"${item.invoiceNumber || ''}"`,
      `"${item.category || ''}"`,
      item.approvalStatus,
      item.budgetLineItemId || ''
    ]);

    return this.buildCSV(headers, rows, options.includeHeaders);
  }

  // Utility Methods

  private static buildCSV(headers: string[], rows: (string | number)[][], includeHeaders: boolean): string {
    const lines: string[] = [];
    
    if (includeHeaders) {
      lines.push(headers.join(','));
    }
    
    lines.push(...rows.map(row => row.map(String).join(',')));
    
    return lines.join('\n');
  }

  private static formatCurrency(amount: number, format: 'USD' | 'numeric'): string {
    if (format === 'numeric') {
      return amount.toFixed(2);
    }
    return amount.toFixed(2); // Remove currency symbol for ERP imports
  }

  private static formatDate(dateString: string, format: 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'DD/MM/YYYY'): string {
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();

    switch (format) {
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      case 'DD/MM/YYYY':
        return `${day}/${month}/${year}`;
      default:
        return `${year}-${month}-${day}`;
    }
  }

  private static extractFundCode(grantId: string): string {
    // Extract fund code from grant ID or use default
    return grantId.substring(0, 3).toUpperCase() || 'GNT';
  }

  private static mapCategoryToDepartment(category: string): string {
    const mapping: Record<string, string> = {
      'Personnel': '100',
      'Equipment': '200', 
      'Travel': '300',
      'Supplies': '400',
      'Contractual': '500',
      'Other': '900'
    };
    return mapping[category] || '900';
  }

  private static mapCategoryToAccount(category: string): string {
    const mapping: Record<string, string> = {
      'Personnel': '51000',
      'Equipment': '52000',
      'Travel': '53000',
      'Supplies': '54000',
      'Contractual': '55000',
      'Other': '59000'
    };
    return mapping[category] || '59000';
  }

  private static mapCategoryToQBAccount(category: string): string {
    const mapping: Record<string, string> = {
      'Personnel': 'Payroll Expenses',
      'Equipment': 'Equipment',
      'Travel': 'Travel',
      'Supplies': 'Office Supplies',
      'Contractual': 'Professional Services',
      'Other': 'Other Expenses'
    };
    return mapping[category] || 'Other Expenses';
  }

  private static mapCategoryToQBDetailType(category: string): string {
    const mapping: Record<string, string> = {
      'Personnel': 'Payroll',
      'Equipment': 'Equipment Rental',
      'Travel': 'Travel',
      'Supplies': 'Supplies',
      'Contractual': 'Professional Services',
      'Other': 'Other Business Expenses'
    };
    return mapping[category] || 'Other Business Expenses';
  }
}

/**
 * Download CSV file to user's device
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Get available ERP formats
 */
export function getAvailableERPFormats(): Array<{value: ERPFormat, label: string, description: string}> {
  return [
    { 
      value: 'munis', 
      label: 'Tyler Munis', 
      description: 'Standard format for Tyler Munis ERP systems' 
    },
    { 
      value: 'tyler', 
      label: 'Tyler Technologies', 
      description: 'Standard format for Tyler ERP systems' 
    },
    { 
      value: 'quickbooks', 
      label: 'QuickBooks', 
      description: 'Chart of accounts format for QuickBooks' 
    },
    { 
      value: 'generic', 
      label: 'Generic CSV', 
      description: 'Standard CSV format for other systems' 
    }
  ];
}