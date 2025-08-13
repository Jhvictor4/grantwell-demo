import './styles/main.css';
import { SearchBar, type SearchFilters } from './components/SearchBar';
import { ResultsTable } from './components/ResultsTable';
import { DetailPanel } from './components/DetailPanel';
import { StatisticsPanel } from './components/StatisticsPanel';
import { GrantsApiService } from './services/grantsApi';
import type { Grant } from './types/grants';

class GrantsApp {
  private searchBar: SearchBar;
  private resultsTable: ResultsTable;
  private detailPanel: DetailPanel;
  private statisticsPanel: StatisticsPanel;
  private appContainer: HTMLElement;

  constructor() {
    this.appContainer = document.getElementById('app')!;
    this.setupLayout();
    
    // Initialize components
    this.searchBar = new SearchBar((filters) => this.handleSearch(filters));
    this.resultsTable = new ResultsTable((grant) => this.handleGrantClick(grant));
    this.detailPanel = new DetailPanel();
    this.statisticsPanel = new StatisticsPanel((filterType, filterValue) => 
      this.handleFilterChange(filterType, filterValue)
    );
    
    this.renderComponents();
    this.loadInitialData();
  }

  private setupLayout(): void {
    this.appContainer.innerHTML = `
      <div class="app">
        <header class="header">
          <!-- Search bar will be inserted here -->
        </header>
        <main class="main-content">
          <!-- Statistics panel will be inserted here -->
          <div class="results-panel">
            <!-- Results table will be inserted here -->
          </div>
          <!-- Detail panel will be inserted here -->
        </main>
      </div>
    `;
  }

  private renderComponents(): void {
    // Insert search bar
    const header = this.appContainer.querySelector('.header')!;
    header.appendChild(this.searchBar.getElement());

    // Insert statistics panel
    const mainContent = this.appContainer.querySelector('.main-content')!;
    mainContent.insertBefore(this.statisticsPanel.getElement(), mainContent.firstChild);

    // Insert results table
    const resultsPanel = this.appContainer.querySelector('.results-panel')!;
    resultsPanel.appendChild(this.resultsTable.getElement());

    // Insert detail panel
    mainContent.appendChild(this.detailPanel.getElement());

    // Focus search input
    this.searchBar.focus();
  }

  private async loadInitialData(): Promise<void> {
    // Load all grants initially with default filters
    const defaultFilters: SearchFilters = {
      keyword: '',
      cfda: null,
      agencies: null,
      sortBy: 'openDate|desc',
      rows: 5000,
      eligibilities: null,
      fundingCategories: null,
      fundingInstruments: null,
      dateRange: '',
      oppStatuses: 'forecasted|posted'
    };
    await this.handleSearch(defaultFilters);
  }

  private async handleSearch(filters: SearchFilters): Promise<void> {
    try {
      this.searchBar.setLoading(true);
      this.resultsTable.showLoading();
      this.statisticsPanel.showLoading();

      const response = await GrantsApiService.searchGrants(filters);
      
      // Handle error messages in response
      if (response.errorMsgs && response.errorMsgs.length > 0) {
        throw new Error(response.errorMsgs.join('; '));
      }

      const grants = response.oppHits || [];
      
      this.resultsTable.updateResults(grants);
      this.statisticsPanel.updateStatistics(response);

      // Close detail panel if open
      if (this.detailPanel.getIsOpen()) {
        this.detailPanel.close();
      }

    } catch (error) {
      console.error('Search error:', error);
      this.resultsTable.showError(
        error instanceof Error ? error.message : 'Search failed'
      );
      this.statisticsPanel.showError(
        error instanceof Error ? error.message : 'Search failed'
      );
    } finally {
      this.searchBar.setLoading(false);
    }
  }

  private async handleGrantClick(grant: Grant): Promise<void> {
    if (!grant.id) {
      console.error('Grant ID is missing');
      return;
    }

    await this.detailPanel.showDetail(grant.id);
  }

  private async handleFilterChange(filterType: string, filterValue: string): Promise<void> {
    // For now, just show an alert with the filter info
    // In a full implementation, you would modify the search request to include these filters
    console.log(`Filter clicked: ${filterType} = ${filterValue}`);
    
    // Show a simple notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #333;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      z-index: 1000;
      font-size: 0.9rem;
    `;
    notification.textContent = `Filter: ${filterType} = ${filterValue}`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 2000);
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new GrantsApp();
});