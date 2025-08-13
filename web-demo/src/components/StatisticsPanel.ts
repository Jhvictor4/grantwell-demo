import type { SearchResponse } from '../types/grants';

export class StatisticsPanel {
  private container: HTMLElement;
  private onFilterChange: (filterType: string, filterValue: string) => void;

  constructor(onFilterChange: (filterType: string, filterValue: string) => void) {
    this.onFilterChange = onFilterChange;
    this.container = this.createElement();
  }

  private createElement(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'statistics-panel';
    panel.innerHTML = `
      <div class="statistics-header">
        <h3>Search Statistics</h3>
      </div>
      <div class="statistics-content">
        <div class="loading">Search to see statistics</div>
      </div>
    `;
    return panel;
  }

  updateStatistics(response: SearchResponse): void {
    const content = this.container.querySelector('.statistics-content')!;
    
    const sections: string[] = [];
    
    // Total results
    sections.push(`
      <div class="stat-section">
        <h4>Results</h4>
        <div class="stat-item">
          <span class="stat-label">Total Found:</span>
          <span class="stat-value">${response.hitCount.toLocaleString()}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Showing:</span>
          <span class="stat-value">${response.oppHits.length}</span>
        </div>
      </div>
    `);

    // Status breakdown
    if (response.oppStatusOptions && response.oppStatusOptions.length > 0) {
      const statusItems = response.oppStatusOptions
        .map(status => `
          <div class="stat-item clickable" data-filter-type="oppStatus" data-filter-value="${status.value}">
            <span class="stat-label">${this.capitalizeFirst(status.label)}:</span>
            <span class="stat-value">${status.count.toLocaleString()}</span>
          </div>
        `).join('');
      
      sections.push(`
        <div class="stat-section">
          <h4>Status Breakdown</h4>
          ${statusItems}
        </div>
      `);
    }

    // Funding categories
    if (response.fundingCategories && response.fundingCategories.length > 0) {
      const categoryItems = response.fundingCategories
        .slice(0, 8) // Show top 8
        .map(category => `
          <div class="stat-item clickable" data-filter-type="fundingCategories" data-filter-value="${category.value}">
            <span class="stat-label">${this.truncateText(category.label, 25)}:</span>
            <span class="stat-value">${category.count}</span>
          </div>
        `).join('');
      
      sections.push(`
        <div class="stat-section">
          <h4>Funding Categories</h4>
          ${categoryItems}
          ${response.fundingCategories.length > 8 ? `<div class="stat-item"><small>+${response.fundingCategories.length - 8} more...</small></div>` : ''}
        </div>
      `);
    }

    // Top agencies
    if (response.agencies && response.agencies.length > 0) {
      const agencyItems = response.agencies
        .slice(0, 6) // Show top 6
        .map(agency => `
          <div class="stat-item clickable" data-filter-type="agencies" data-filter-value="${agency.value}">
            <span class="stat-label">${this.truncateText(agency.label, 25)}:</span>
            <span class="stat-value">${agency.count}</span>
          </div>
        `).join('');
      
      sections.push(`
        <div class="stat-section">
          <h4>Top Agencies</h4>
          ${agencyItems}
          ${response.agencies.length > 6 ? `<div class="stat-item"><small>+${response.agencies.length - 6} more...</small></div>` : ''}
        </div>
      `);
    }

    // Funding instruments
    if (response.fundingInstruments && response.fundingInstruments.length > 0) {
      const instrumentItems = response.fundingInstruments
        .map(instrument => `
          <div class="stat-item clickable" data-filter-type="fundingInstruments" data-filter-value="${instrument.value}">
            <span class="stat-label">${instrument.label}:</span>
            <span class="stat-value">${instrument.count}</span>
          </div>
        `).join('');
      
      sections.push(`
        <div class="stat-section">
          <h4>Funding Types</h4>
          ${instrumentItems}
        </div>
      `);
    }

    // Eligibility types (show top ones)
    if (response.eligibilities && response.eligibilities.length > 0) {
      const eligibilityItems = response.eligibilities
        .slice(0, 6) // Show top 6
        .map(eligibility => `
          <div class="stat-item clickable" data-filter-type="eligibilities" data-filter-value="${eligibility.value}">
            <span class="stat-label">${this.truncateText(eligibility.label, 30)}:</span>
            <span class="stat-value">${eligibility.count}</span>
          </div>
        `).join('');
      
      sections.push(`
        <div class="stat-section">
          <h4>Top Eligibilities</h4>
          ${eligibilityItems}
          ${response.eligibilities.length > 6 ? `<div class="stat-item"><small>+${response.eligibilities.length - 6} more...</small></div>` : ''}
        </div>
      `);
    }

    // Date ranges (if available)
    if (response.dateRangeOptions && response.dateRangeOptions.length > 0) {
      const dateItems = response.dateRangeOptions
        .map(dateRange => `
          <div class="stat-item">
            <span class="stat-label">${dateRange.label.replace('Posted Date - ', '')}:</span>
            <span class="stat-value">${dateRange.count}</span>
          </div>
        `).join('');
      
      sections.push(`
        <div class="stat-section">
          <h4>Recent Activity</h4>
          ${dateItems}
        </div>
      `);
    }

    content.innerHTML = sections.join('');
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const clickableItems = this.container.querySelectorAll('.stat-item.clickable');
    clickableItems.forEach(item => {
      item.addEventListener('click', () => {
        const filterType = item.getAttribute('data-filter-type')!;
        const filterValue = item.getAttribute('data-filter-value')!;
        this.onFilterChange(filterType, filterValue);
      });
    });
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private truncateText(text: string, maxLength: number): string {
    if (!text) return 'N/A';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  showLoading(): void {
    const content = this.container.querySelector('.statistics-content')!;
    content.innerHTML = '<div class="loading">Loading statistics...</div>';
  }

  showError(message: string): void {
    const content = this.container.querySelector('.statistics-content')!;
    content.innerHTML = `<div class="empty">Error: ${message}</div>`;
  }

  clear(): void {
    const content = this.container.querySelector('.statistics-content')!;
    content.innerHTML = '<div class="empty">Search to see statistics</div>';
  }

  getElement(): HTMLElement {
    return this.container;
  }
}