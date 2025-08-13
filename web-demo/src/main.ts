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
  private isFederalMode: boolean = true;

  constructor() {
    this.appContainer = document.getElementById('app')!;
    this.setupLayout();
    
    // Initialize components
    this.searchBar = new SearchBar(
      (filters) => this.handleSearch(filters),
      (state) => this.handleStateSearch(state)
    );
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
          <div class="nav">
            <div class="brand" aria-label="Home">
              <span class="brand-dot"></span>
              <span class="brand-name">Grants</span>
            </div>
            <div class="nav-center" id="nav-search"><!-- Search bar --></div>
            <div class="nav-actions">
              <label class="toggle-switch" title="Toggle Federal/State">
                <input type="checkbox" class="mode-checkbox" ${this.isFederalMode ? 'checked' : ''}>
                <span class="toggle-slider"></span>
                <span class="toggle-label">${this.isFederalMode ? 'Federal' : 'State'}</span>
              </label>
            </div>
          </div>
        </header>
        <main class="main-content ${this.isFederalMode ? 'federal-mode' : 'state-mode'}">
          <!-- Content will be dynamically switched -->
        </main>
      </div>
    `;
    
    // Setup mode toggle listener
    const modeCheckbox = this.appContainer.querySelector('.mode-checkbox') as HTMLInputElement;
    modeCheckbox.addEventListener('change', () => {
      this.toggleMode();
    });
  }

  private toggleMode(): void {
    this.isFederalMode = !this.isFederalMode;
    
    // Update toggle label
    const toggleLabel = this.appContainer.querySelector('.toggle-label')!;
    toggleLabel.textContent = this.isFederalMode ? 'Federal' : 'State';
    
    // Update main content class
    const mainContent = this.appContainer.querySelector('.main-content')!;
    mainContent.className = `main-content ${this.isFederalMode ? 'federal-mode' : 'state-mode'}`;
    
    // Re-render content based on mode
    this.renderModeContent();

    // Inform search bar of mode change
    this.searchBar.setMode(!this.isFederalMode);
  }

  private renderComponents(): void {
    // Insert search bar
    const headerSearch = this.appContainer.querySelector('#nav-search')!;
    headerSearch.appendChild(this.searchBar.getElement());

    // Render initial mode content
    this.renderModeContent();

    // Focus search input
    this.searchBar.focus();
  }

  private renderModeContent(): void {
    const mainContent = this.appContainer.querySelector('.main-content')!;
    
    if (this.isFederalMode) {
      // Federal mode: existing layout
      mainContent.innerHTML = `
        <!-- Statistics panel will be inserted here -->
        <div class="results-panel">
          <!-- Results table will be inserted here -->
        </div>
        <!-- Detail panel will be inserted here -->
      `;
      
      // Insert existing components
      mainContent.insertBefore(this.statisticsPanel.getElement(), mainContent.firstChild);
      const resultsPanel = mainContent.querySelector('.results-panel')!;
      resultsPanel.appendChild(this.resultsTable.getElement());
      mainContent.appendChild(this.detailPanel.getElement());
      
    } else {
      // State mode: chat + state detail layout
      mainContent.innerHTML = `
        <div class="chat-panel">
          <div class="chat-header">
            <h3>🤖 AI Agent</h3>
            <span class="chat-subtitle">Discovering state grant opportunities</span>
          </div>
          <div class="chat-messages">
            <div class="chat-message system">
              <div class="message-content">
                Welcome to State Grant Discovery! Select a state above to begin analyzing grant opportunities.
              </div>
            </div>
          </div>
          <div class="chat-input-area">
            <input type="text" placeholder="Ask about state grants..." class="chat-input" disabled>
            <button class="chat-send" disabled>Send</button>
          </div>
        </div>
        <div class="state-detail-panel">
          <div class="state-header">
            <h3>📍 State Grant Information</h3>
            <span class="state-subtitle">AI-discovered opportunities</span>
          </div>
          <div class="state-content">
            <div class="empty-state">
              <div class="empty-icon">🗺️</div>
              <h4>No State Selected</h4>
              <p>Choose a state from the search bar to discover grant opportunities</p>
            </div>
          </div>
        </div>
      `;

      // Put the search bar into state mode
      this.searchBar.setMode(true);
    }
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
    } as unknown as SearchFilters;
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
    if (!(grant as any).id) {
      console.error('Grant ID is missing');
      return;
    }

    await this.detailPanel.showDetail((grant as any).id);
  }

  private async handleFilterChange(filterType: string, filterValue: string): Promise<void> {
    console.log(`Filter clicked: ${filterType} = ${filterValue}`);
    
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

  private handleStateSearch(state: string): void {
    // Append a simple system message in the chat panel
    const chatMessages = this.appContainer.querySelector('.chat-messages');
    if (chatMessages) {
      const msg = document.createElement('div');
      msg.className = 'chat-message user';
      msg.innerHTML = `<div class="message-content">Find latest state grants for <strong>${state}</strong></div>`;
      chatMessages.appendChild(msg);

      const thinking = document.createElement('div');
      thinking.className = 'chat-message system';
      thinking.innerHTML = `<div class="message-content">Using web search + Firecrawl MCP to identify official state sources... (stub)</div>`;
      chatMessages.appendChild(thinking);

      (chatMessages as HTMLElement).scrollTop = (chatMessages as HTMLElement).scrollHeight;
    }

    // Update state detail placeholder
    const stateContent = this.appContainer.querySelector('.state-content');
    if (stateContent) {
      (stateContent as HTMLElement).innerHTML = `
        <div class="state-intro">
          <p>Selected state: <strong>${state}</strong></p>
          <p>Source registry persistence: stubbed (localStorage) – agent integration TODO.</p>
        </div>
      `;
    }
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new GrantsApp();
});

