import './styles/main.css';
import { SearchBar, type SearchFilters } from './components/SearchBar';
import { ResultsTable } from './components/ResultsTable';
import { DetailPanel } from './components/DetailPanel';
import { StatisticsPanel } from './components/StatisticsPanel';
import { GrantsApiService } from './services/grantsApi';
import { stateGrantAgent } from './services/agentService';
import type { Grant } from './types/grants';

// Inject OPENAI_API_KEY for browser environment (Agents SDK expects process.env)
try {
  (window as any).process = (window as any).process || { env: {} };
  (window as any).process.env = (window as any).process.env || {};
  (window as any).process.env.OPENAI_API_KEY = (import.meta as any).env?.VITE_OPENAI_API_KEY;
} catch (_) {
  // no-op
}

class GrantsApp {
  private searchBar: SearchBar;
  private resultsTable: ResultsTable;
  private detailPanel: DetailPanel;
  private statisticsPanel: StatisticsPanel;
  private appContainer: HTMLElement;
  private isFederalMode: boolean = true;
  private currentState: string | null = null;

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
    // Read persisted mode
    const persistedMode = localStorage.getItem('grants_mode');
    if (persistedMode === 'state') this.isFederalMode = false;

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
    
    // Persist mode
    localStorage.setItem('grants_mode', this.isFederalMode ? 'federal' : 'state');

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
            <input type="text" placeholder="Ask about state grants..." class="chat-input">
            <button class="chat-send">Send</button>
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

      // Wire chat input
      const inputEl = mainContent.querySelector('.chat-input') as HTMLInputElement;
      const sendBtn = mainContent.querySelector('.chat-send') as HTMLButtonElement;
      const messagesEl = mainContent.querySelector('.chat-messages') as HTMLElement;

      const sendChat = async () => {
        const text = inputEl.value.trim();
        if (!text) return;
        inputEl.value = '';
        // Append user message
        const userMsg = document.createElement('div');
        userMsg.className = 'chat-message user';
        userMsg.innerHTML = `<div class="message-content">${text}</div>`;
        messagesEl.appendChild(userMsg);

        // Thinking
        const thinking = document.createElement('div');
        thinking.className = 'chat-message system thinking';
        thinking.innerHTML = `<div class="message-content">🤖 Thinking...</div>`;
        messagesEl.appendChild(thinking);
        messagesEl.scrollTop = messagesEl.scrollHeight;

        // Use selected state context; if missing, ask to select
        const state = this.currentState;
        if (!state) {
          thinking.remove();
          const err = document.createElement('div');
          err.className = 'chat-message error';
          err.innerHTML = `<div class="message-content">Please select a state first.</div>`;
          messagesEl.appendChild(err);
          return;
        }

        try {
          const response = await stateGrantAgent.searchStateGrants(state, text);
          thinking.remove();
          const agentMsg = document.createElement('div');
          agentMsg.className = 'chat-message agent';
          agentMsg.innerHTML = `<div class="message-content"><div class="agent-response">${this.formatAgentResponse(response)}</div></div>`;
          messagesEl.appendChild(agentMsg);
          messagesEl.scrollTop = messagesEl.scrollHeight;
        } catch (e) {
          thinking.remove();
          const err = document.createElement('div');
          err.className = 'chat-message error';
          err.innerHTML = `<div class="message-content">Failed to get answer. ${e instanceof Error ? e.message : 'Unknown error'}</div>`;
          messagesEl.appendChild(err);
        }
      };

      sendBtn.addEventListener('click', sendChat);
      inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') sendChat();
      });
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
      fundingCategories: 'LJL',
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

  private async handleStateSearch(state: string): Promise<void> {
    const chatMessages = this.appContainer.querySelector('.chat-messages');
    const stateContent = this.appContainer.querySelector('.state-content');
    this.currentState = state;
    
    // Add user message
    if (chatMessages) {
      const msg = document.createElement('div');
      msg.className = 'chat-message user';
      msg.innerHTML = `<div class="message-content">Find latest state grants for <strong>${state}</strong></div>`;
      chatMessages.appendChild(msg);

      // Add thinking message
      const thinking = document.createElement('div');
      thinking.className = 'chat-message system thinking';
      thinking.innerHTML = `<div class="message-content">🤖 Using GPT-5 + Firecrawl MCP to discover state grant opportunities...</div>`;
      chatMessages.appendChild(thinking);

      (chatMessages as HTMLElement).scrollTop = (chatMessages as HTMLElement).scrollHeight;
    }

    // Update state content with loading state
    if (stateContent) {
      (stateContent as HTMLElement).innerHTML = `
        <div class="state-loading">
          <div class="loading-spinner"></div>
          <p>Analyzing grant opportunities for <strong>${state}</strong>...</p>
          <p class="loading-detail">AI agent is searching official sources and analyzing funding programs</p>
        </div>
      `;
    }

    try {
      // Use the AI agent to search for state grants
      console.log(`🚀 Starting AI-powered grant search for ${state}`);
      
      const agentResponse = await stateGrantAgent.searchStateGrants(state);
      
      // Remove thinking message
      const thinkingMessage = chatMessages?.querySelector('.thinking');
      if (thinkingMessage) {
        thinkingMessage.remove();
      }

      // Add agent response
      if (chatMessages) {
        const responseMsg = document.createElement('div');
        responseMsg.className = 'chat-message agent';
        responseMsg.innerHTML = `
          <div class="message-content">
            <div class="agent-response">
              ${this.formatAgentResponse(agentResponse)}
            </div>
          </div>
        `;
        chatMessages.appendChild(responseMsg);
        (chatMessages as HTMLElement).scrollTop = (chatMessages as HTMLElement).scrollHeight;
      }

      // Update state content with results
      if (stateContent) {
        (stateContent as HTMLElement).innerHTML = `
          <div class="state-results">
            <div class="state-header">
              <h4>📍 Grant Discovery Results for ${state}</h4>
              <span class="discovery-badge">AI-Powered Analysis</span>
            </div>
            <div class="agent-summary">
              ${this.formatStateResults(agentResponse, state)}
            </div>
            <div class="next-steps">
              <h5>🎯 Recommended Next Steps</h5>
              <ul>
                <li>Review eligibility requirements for identified opportunities</li>
                <li>Prepare required documentation</li>
                <li>Set up deadline reminders</li>
                <li>Contact program officers for clarification</li>
              </ul>
            </div>
          </div>
        `;
      }

    } catch (error) {
      console.error('Error in AI agent state search:', error);
      
      // Remove thinking message
      const thinkingMessage = chatMessages?.querySelector('.thinking');
      if (thinkingMessage) {
        thinkingMessage.remove();
      }

      // Add error message
      if (chatMessages) {
        const errorMsg = document.createElement('div');
        errorMsg.className = 'chat-message error';
        errorMsg.innerHTML = `
          <div class="message-content">
            ❌ Error: Failed to analyze grants for ${state}. ${error instanceof Error ? error.message : 'Unknown error'}
          </div>
        `;
        chatMessages.appendChild(errorMsg);
        (chatMessages as HTMLElement).scrollTop = (chatMessages as HTMLElement).scrollHeight;
      }

      // Update state content with error
      if (stateContent) {
        (stateContent as HTMLElement).innerHTML = `
          <div class="state-error">
            <div class="error-icon">⚠️</div>
            <h4>Analysis Failed</h4>
            <p>Unable to discover grants for ${state}. Please try again.</p>
            <p class="error-detail">${error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
        `;
      }
    }
  }

  private formatAgentResponse(response: string): string {
    // Format the agent response with proper HTML structure
    const lines = response.split('\n');
    let formattedResponse = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      if (trimmedLine.startsWith('##')) {
        formattedResponse += `<h4>${trimmedLine.replace('##', '').trim()}</h4>`;
      } else if (trimmedLine.startsWith('- ')) {
        formattedResponse += `<li>${trimmedLine.replace('- ', '').trim()}</li>`;
      } else if (trimmedLine.includes(':') && trimmedLine.length < 100) {
        formattedResponse += `<strong>${trimmedLine}</strong><br>`;
      } else {
        formattedResponse += `<p>${trimmedLine}</p>`;
      }
    }
    
    return formattedResponse;
  }

  private formatStateResults(response: string, state: string): string {
    // Create a structured summary of the state results
    return `
      <div class="summary-card">
        <h5>🔍 Discovery Summary</h5>
        <p>AI agent analyzed official ${state} funding sources and identified current opportunities.</p>
      </div>
      <div class="analysis-content">
        ${this.formatAgentResponse(response)}
      </div>
      <div class="methodology">
        <h6>🛠️ AI Analysis Methodology</h6>
        <p>Using GPT-5 model with Firecrawl MCP tools to:</p>
        <ul>
          <li>Search official state grant portals</li>
          <li>Extract current funding opportunities</li>
          <li>Analyze eligibility and requirements</li>
          <li>Prioritize based on deadlines and fit</li>
        </ul>
      </div>
    `;
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new GrantsApp();
});

