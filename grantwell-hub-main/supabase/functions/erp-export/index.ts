import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ERPExportRequest {
  export_type: 'budget' | 'expenses' | 'combined';
  format: 'munis' | 'tyler' | 'quickbooks' | 'generic';
  grant_ids?: string[];
  fiscal_year?: number;
  quarter?: number;
  include_headers?: boolean;
  date_format?: 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'DD/MM/YYYY';
  currency_format?: 'USD' | 'numeric';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const exportRequest: ERPExportRequest = await req.json();
    console.log('ERP Export request:', exportRequest);

    let csvContent = '';
    let recordCount = 0;

    if (exportRequest.export_type === 'budget' || exportRequest.export_type === 'combined') {
      // Fetch budget data
      let budgetQuery = supabase
        .from('budget_line_items')
        .select(`
          *,
          grants!inner (
            id,
            title
          )
        `);

      if (exportRequest.grant_ids?.length) {
        budgetQuery = budgetQuery.in('grant_id', exportRequest.grant_ids);
      }

      if (exportRequest.fiscal_year) {
        budgetQuery = budgetQuery.eq('fiscal_year', exportRequest.fiscal_year);
      }

      if (exportRequest.quarter) {
        budgetQuery = budgetQuery.eq('quarter', exportRequest.quarter);
      }

      const { data: budgetData, error: budgetError } = await budgetQuery;

      if (budgetError) {
        throw new Error(`Budget data fetch error: ${budgetError.message}`);
      }

      if (budgetData && budgetData.length > 0) {
        csvContent += generateBudgetCSV(budgetData, exportRequest);
        recordCount += budgetData.length;
      }
    }

    if (exportRequest.export_type === 'expenses' || exportRequest.export_type === 'combined') {
      // Fetch expense data
      let expenseQuery = supabase
        .from('expenses')
        .select(`
          *,
          grants!inner (
            id,
            title
          ),
          budget_line_items (
            category
          )
        `);

      if (exportRequest.grant_ids?.length) {
        expenseQuery = expenseQuery.in('grant_id', exportRequest.grant_ids);
      }

      const { data: expenseData, error: expenseError } = await expenseQuery;

      if (expenseError) {
        throw new Error(`Expense data fetch error: ${expenseError.message}`);
      }

      if (expenseData && expenseData.length > 0) {
        if (csvContent && exportRequest.export_type === 'combined') {
          csvContent += '\n\n--- EXPENSE DATA ---\n';
        }
        csvContent += generateExpenseCSV(expenseData, exportRequest);
        recordCount += expenseData.length;
      }
    }

    // Record export in history
    const fileName = `${exportRequest.export_type}-export-${exportRequest.format}-${new Date().toISOString().split('T')[0]}.csv`;
    
    await supabase
      .from('erp_export_history')
      .insert({
        export_type: exportRequest.export_type,
        format: exportRequest.format,
        file_name: fileName,
        record_count: recordCount,
        parameters: exportRequest,
        status: 'completed'
      });

    return new Response(
      JSON.stringify({
        success: true,
        csv_content: csvContent,
        file_name: fileName,
        record_count: recordCount
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('ERP Export error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: 'Failed to generate ERP export'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function generateBudgetCSV(data: any[], options: ERPExportRequest): string {
  const { format, include_headers = true, date_format = 'MM/DD/YYYY', currency_format = 'numeric' } = options;
  
  let headers: string[] = [];
  let rows: string[][] = [];

  switch (format) {
    case 'munis':
      headers = ['Fund', 'Department', 'Account', 'Project', 'Description', 'Budgeted_Amount', 'YTD_Actual', 'Encumbered', 'Available', 'Fiscal_Year'];
      rows = data.map(item => [
        extractFundCode(item.grant_id),
        mapCategoryToDepartment(item.category || 'Other'),
        mapCategoryToAccount(item.category || 'Other'),
        item.grant_id.substring(0, 8),
        `"${item.item_name || item.description || 'Budget Item'}"`,
        formatCurrency(item.budgeted_amount || 0, currency_format),
        formatCurrency(item.spent_amount || 0, currency_format),
        formatCurrency((item.allocated_amount || 0) - (item.spent_amount || 0), currency_format),
        formatCurrency((item.budgeted_amount || 0) - (item.spent_amount || 0), currency_format),
        (item.fiscal_year || new Date().getFullYear()).toString()
      ]);
      break;

    case 'tyler':
      headers = ['Entity', 'Fund_Code', 'Dept_Code', 'Account_Code', 'Grant_ID', 'Line_Description', 'Original_Budget', 'Current_Budget', 'YTD_Expenditures', 'Budget_Balance'];
      rows = data.map(item => [
        '001',
        extractFundCode(item.grant_id),
        mapCategoryToDepartment(item.category || 'Other'),
        mapCategoryToAccount(item.category || 'Other'),
        `"${item.grant_id}"`,
        `"${item.item_name || item.description || 'Budget Item'}"`,
        formatCurrency(item.budgeted_amount || 0, currency_format),
        formatCurrency(item.allocated_amount || 0, currency_format),
        formatCurrency(item.spent_amount || 0, currency_format),
        formatCurrency((item.budgeted_amount || 0) - (item.spent_amount || 0), currency_format)
      ]);
      break;

    case 'quickbooks':
      headers = ['Account', 'Account_Type', 'Name', 'Description', 'Budget_Amount', 'Actual_Amount', 'Class'];
      rows = data.map(item => [
        mapCategoryToQBAccount(item.category || 'Other'),
        'Expense',
        `"${item.item_name || item.description || 'Budget Item'}"`,
        `"${item.description || item.item_name || 'Budget Item'}"`,
        formatCurrency(item.budgeted_amount || 0, currency_format),
        formatCurrency(item.spent_amount || 0, currency_format),
        `"${item.grants?.title || 'Grant'}"`
      ]);
      break;

    default: // generic
      headers = ['Grant_ID', 'Grant_Title', 'Category', 'Item_Name', 'Budgeted_Amount', 'Spent_Amount', 'Remaining_Amount', 'Fiscal_Year'];
      rows = data.map(item => [
        `"${item.grant_id}"`,
        `"${item.grants?.title || 'Unknown Grant'}"`,
        `"${item.category || 'Other'}"`,
        `"${item.item_name || item.description || 'Budget Item'}"`,
        formatCurrency(item.budgeted_amount || 0, currency_format),
        formatCurrency(item.spent_amount || 0, currency_format),
        formatCurrency((item.budgeted_amount || 0) - (item.spent_amount || 0), currency_format),
        (item.fiscal_year || new Date().getFullYear()).toString()
      ]);
  }

  const lines: string[] = [];
  if (include_headers) {
    lines.push(headers.join(','));
  }
  lines.push(...rows.map(row => row.join(',')));
  
  return lines.join('\n');
}

function generateExpenseCSV(data: any[], options: ERPExportRequest): string {
  const { format, include_headers = true, date_format = 'MM/DD/YYYY', currency_format = 'numeric' } = options;
  
  let headers: string[] = [];
  let rows: string[][] = [];

  switch (format) {
    case 'munis':
      headers = ['Voucher_Number', 'Vendor', 'Invoice_Number', 'Invoice_Date', 'Description', 'Amount', 'Fund', 'Department', 'Account'];
      rows = data.map(item => [
        item.id.substring(0, 10),
        `"${item.vendor || 'Unknown'}"`,
        `"${item.invoice_number || ''}"`,
        formatDate(item.date, date_format),
        `"${item.description}"`,
        formatCurrency(item.amount, currency_format),
        extractFundCode(item.grant_id),
        mapCategoryToDepartment(item.budget_line_items?.category || 'Other'),
        mapCategoryToAccount(item.budget_line_items?.category || 'Other')
      ]);
      break;

    case 'tyler':
      headers = ['Transaction_ID', 'Entity', 'Fund_Code', 'Dept_Code', 'Account_Code', 'Vendor_ID', 'Transaction_Date', 'Amount', 'Description'];
      rows = data.map(item => [
        item.id,
        '001',
        extractFundCode(item.grant_id),
        mapCategoryToDepartment(item.budget_line_items?.category || 'Other'),
        mapCategoryToAccount(item.budget_line_items?.category || 'Other'),
        `"${item.vendor || 'TBD'}"`,
        formatDate(item.date, date_format),
        formatCurrency(item.amount, currency_format),
        `"${item.description}"`
      ]);
      break;

    case 'quickbooks':
      headers = ['Date', 'Account', 'Vendor', 'Amount', 'Description', 'Class'];
      rows = data.map(item => [
        formatDate(item.date, date_format),
        mapCategoryToQBAccount(item.budget_line_items?.category || 'Other'),
        `"${item.vendor || 'Unknown'}"`,
        formatCurrency(item.amount, currency_format),
        `"${item.description}"`,
        `"${item.grants?.title || 'Grant'}"`
      ]);
      break;

    default: // generic
      headers = ['Expense_ID', 'Grant_ID', 'Grant_Title', 'Date', 'Amount', 'Description', 'Vendor', 'Approval_Status'];
      rows = data.map(item => [
        item.id,
        `"${item.grant_id}"`,
        `"${item.grants?.title || 'Unknown Grant'}"`,
        formatDate(item.date, date_format),
        formatCurrency(item.amount, currency_format),
        `"${item.description}"`,
        `"${item.vendor || ''}"`,
        item.approval_status || 'pending'
      ]);
  }

  const lines: string[] = [];
  if (include_headers) {
    lines.push(headers.join(','));
  }
  lines.push(...rows.map(row => row.join(',')));
  
  return lines.join('\n');
}

// Utility functions
function formatCurrency(amount: number, format: 'USD' | 'numeric'): string {
  return (amount || 0).toFixed(2);
}

function formatDate(dateString: string, format: 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'DD/MM/YYYY'): string {
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

function extractFundCode(grantId: string): string {
  return grantId.substring(0, 3).toUpperCase() || 'GNT';
}

function mapCategoryToDepartment(category: string): string {
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

function mapCategoryToAccount(category: string): string {
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

function mapCategoryToQBAccount(category: string): string {
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