import type { Grant } from '../types/grants';

export class ResultsTable {
  private container: HTMLElement;
  private table: HTMLTableElement;
  private onRowClick: (grant: Grant) => void;

  constructor(onRowClick: (grant: Grant) => void) {
    this.onRowClick = onRowClick;
    this.container = this.createElement();
    this.table = this.container.querySelector('.results-table') as HTMLTableElement;
  }

  private createElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'results-container';
    container.innerHTML = `
      <table class="results-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Agency</th>
            <th>Open Date</th>
            <th>Close Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    `;
    return container;
  }

  updateResults(grants: Grant[]): void {
    const tbody = this.table.querySelector('tbody')!;
    tbody.innerHTML = '';

    if (grants.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="empty">No grants found</td>
        </tr>
      `;
      return;
    }

    grants.forEach((grant) => {
      const row = this.createRow(grant);
      tbody.appendChild(row);
    });
  }

  private createRow(grant: Grant): HTMLTableRowElement {
    const row = document.createElement('tr');
    row.addEventListener('click', () => this.onRowClick(grant));
    
    const formatDate = (dateStr: string): string => {
      if (!dateStr) return 'N/A';
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
      } catch {
        return dateStr;
      }
    };

    const getStatusClass = (status: string): string => {
      const statusLower = status.toLowerCase();
      if (statusLower.includes('posted')) return 'status-posted';
      if (statusLower.includes('forecast')) return 'status-forecasted';
      if (statusLower.includes('closed')) return 'status-closed';
      return '';
    };

    row.innerHTML = `
      <td class="title">${this.truncateText(grant.title, 60)}</td>
      <td class="agency">${this.truncateText(grant.agency, 30)}</td>
      <td class="date">${formatDate(grant.openDate)}</td>
      <td class="date">${formatDate(grant.closeDate)}</td>
      <td class="status ${getStatusClass(grant.oppStatus)}">${grant.oppStatus}</td>
    `;

    return row;
  }

  private truncateText(text: string, maxLength: number): string {
    if (!text) return 'N/A';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  showLoading(): void {
    const tbody = this.table.querySelector('tbody')!;
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="loading">Loading grants...</td>
      </tr>
    `;
  }

  showError(message: string): void {
    const tbody = this.table.querySelector('tbody')!;
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty">Error: ${message}</td>
      </tr>
    `;
  }

  getElement(): HTMLElement {
    return this.container;
  }
}