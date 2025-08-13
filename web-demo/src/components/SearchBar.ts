export interface SearchFilters {
  keyword: string;
  cfda: string;
  agencies: string;
  sortBy: string;
  rows: number;
  eligibilities: string;
  fundingCategories: string;
  fundingInstruments: string;
  dateRange: string;
  oppStatuses: string;
}

export class SearchBar {
  private container: HTMLElement;
  private input: HTMLInputElement;
  private stateSelect: HTMLSelectElement | null;
  private button: HTMLButtonElement;
  private showFiltersButton: HTMLButtonElement;
  private filtersPanel: HTMLElement;
  private filtersVisible: boolean = false;
  private isStateMode: boolean = false;
  private onSearch: (filters: SearchFilters) => void;
  private onStateSearch?: (state: string) => void;

  constructor(onSearch: (filters: SearchFilters) => void, onStateSearch?: (state: string) => void) {
    this.onSearch = onSearch;
    this.onStateSearch = onStateSearch;
    this.container = this.createElement();
    this.input = this.container.querySelector('.search-input') as HTMLInputElement;
    this.stateSelect = this.container.querySelector('.state-select') as HTMLSelectElement | null;
    this.button = this.container.querySelector('.search-button') as HTMLButtonElement;
    this.showFiltersButton = this.container.querySelector('.show-filters-button') as HTMLButtonElement;
    this.filtersPanel = this.container.querySelector('.filters-panel') as HTMLElement;
    this.setupEventListeners();
  }

  private createElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'search-container';
    container.innerHTML = `
      <div class="search-main">
        <select class="state-select" style="display:none; min-width: 220px;">
          <option value="">Select a State</option>
          ${this.getStates().map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
        <input 
          type="text" 
          class="search-input" 
          placeholder="Search grants by keyword..."
          autocomplete="off"
        />
        <button class="show-filters-button" type="button" title="Show Filters">
          ⚙️
        </button>
        <button class="search-button" type="button">
          Search
        </button>
      </div>
      <div class="filters-panel" style="display: none;">
        <div class="filters-grid">
          <div class="filter-group">
            <label for="cfda-input">CFDA Number</label>
            <input type="text" id="cfda-input" class="filter-input" placeholder="e.g., 16.710">
          </div>
          <div class="filter-group">
            <label for="agencies-select">Agency</label>
            <select id="agencies-select" class="filter-select">
              <option value="">All Agencies</option>
              <option value="DOJ">Department of Justice</option>
              <option value="HHS">Health & Human Services</option>
              <option value="ED">Department of Education</option>
              <option value="DHS">Homeland Security</option>
              <option value="DOD">Department of Defense</option>
              <option value="DOT">Department of Transportation</option>
              <option value="EPA">Environmental Protection Agency</option>
            </select>
          </div>
          <div class="filter-group">
            <label for="sort-select">Sort By</label>
            <select id="sort-select" class="filter-select">
              <option value="openDate|desc">Newest First</option>
              <option value="openDate|asc">Oldest First</option>
              <option value="closeDate|desc">Latest Close Date</option>
              <option value="closeDate|asc">Earliest Close Date</option>
              <option value="title|asc">Title A-Z</option>
              <option value="title|desc">Title Z-A</option>
            </select>
          </div>
          <div class="filter-group">
            <label for="rows-select">Results Limit</label>
            <select id="rows-select" class="filter-select">
              <option value="100">100 results</option>
              <option value="500">500 results</option>
              <option value="1000">1,000 results</option>
              <option value="5000" selected>5,000 results</option>
              <option value="10000">10,000 results</option>
            </select>
          </div>
          <div class="filter-group">
            <label for="eligibilities-select">Eligibility</label>
            <select id="eligibilities-select" class="filter-select">
              <option value="">All Eligible</option>
              <option value="25">State governments</option>
              <option value="04">City or township governments</option>
              <option value="05">County governments</option>
              <option value="00">State governments</option>
              <option value="02">Interstate</option>
              <option value="01">Intrastate</option>
              <option value="06">Independent school districts</option>
              <option value="11">Native American tribal governments (Federally recognized)</option>
              <option value="13">Public and State controlled institutions of higher education</option>
              <option value="20">Private institutions of higher education</option>
              <option value="21">Individuals</option>
              <option value="12">Nonprofits having a 501(c)(3) status with the IRS, other than institutions of higher education</option>
              <option value="23">Small businesses</option>
            </select>
          </div>
          <div class="filter-group">
            <label for="funding-categories-select">Funding Category</label>
            <select id="funding-categories-select" class="filter-select">
              <option value="">All Categories</option>
              <option value="HL">Health</option>
              <option value="ED">Education</option>
              <option value="ST">Science and Technology</option>
              <option value="CD">Community Development</option>
              <option value="EN">Environment</option>
              <option value="AG">Agriculture</option>
              <option value="TR">Transportation</option>
              <option value="HO">Housing</option>
              <option value="IS">Income Security and Social Services</option>
              <option value="LJL">Law, Justice and Legal Services</option>
              <option value="NR">Natural Resources</option>
              <option value="RD">Regional Development</option>
            </select>
          </div>
          <div class="filter-group">
            <label for="funding-instruments-select">Funding Type</label>
            <select id="funding-instruments-select" class="filter-select">
              <option value="">All Types</option>
              <option value="G">Grant</option>
              <option value="CA">Cooperative Agreement</option>
              <option value="PC">Procurement Contract</option>
              <option value="O">Other</option>
            </select>
          </div>
          <div class="filter-group">
            <label for="date-range-select">Date Range</label>
            <select id="date-range-select" class="filter-select">
              <option value="">All Dates</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 3 months</option>
              <option value="180">Last 6 months</option>
              <option value="365">Last year</option>
            </select>
          </div>
          <div class="filter-group">
            <label for="status-select">Status</label>
            <select id="status-select" class="filter-select">
              <option value="forecasted|posted" selected>Forecasted & Posted</option>
              <option value="posted">Posted Only</option>
              <option value="forecasted">Forecasted Only</option>
              <option value="closed">Closed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
        <div class="filters-actions">
          <button type="button" class="clear-filters-button">Clear All</button>
          <button type="button" class="apply-filters-button">Apply Filters</button>
        </div>
      </div>
    `;
    return container;
  }

  private setupEventListeners(): void {
    this.button.addEventListener('click', () => {
      if (this.isStateMode) {
        this.handleStateSearch();
      } else {
        this.handleSearch();
      }
    });

    this.input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (this.isStateMode) {
          this.handleStateSearch();
        } else {
          this.handleSearch();
        }
      }
    });

    this.input.addEventListener('input', () => {
      // Auto-search on empty input to show all grants
      if (!this.isStateMode && this.input.value.trim() === '') {
        this.handleSearch();
      }
    });

    // Toggle filters panel
    this.showFiltersButton.addEventListener('click', () => {
      this.toggleFilters();
    });

    // Apply filters button
    const applyButton = this.container.querySelector('.apply-filters-button') as HTMLButtonElement;
    applyButton.addEventListener('click', () => {
      this.handleSearch();
    });

    // Clear filters button
    const clearButton = this.container.querySelector('.clear-filters-button') as HTMLButtonElement;
    clearButton.addEventListener('click', () => {
      this.clearAllFilters();
    });

    // Enter key on filter inputs
    const filterInputs = this.container.querySelectorAll('.filter-input, .filter-select') as NodeListOf<HTMLElement>;
    filterInputs.forEach(input => {
      input.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') {
          this.handleSearch();
        }
      });
    });
  }

  private toggleFilters(): void {
    this.filtersVisible = !this.filtersVisible;
    this.filtersPanel.style.display = this.filtersVisible ? 'block' : 'none';
    this.showFiltersButton.textContent = this.filtersVisible ? '❌' : '⚙️';
    this.showFiltersButton.title = this.filtersVisible ? 'Hide Filters' : 'Show Filters';
  }

  private clearAllFilters(): void {
    const filterInputs = this.container.querySelectorAll('.filter-input') as NodeListOf<HTMLInputElement>;
    const filterSelects = this.container.querySelectorAll('.filter-select') as NodeListOf<HTMLSelectElement>;
    
    filterInputs.forEach(input => input.value = '');
    filterSelects.forEach(select => {
      // Reset to first option, except for specific defaults
      if (select.id === 'sort-select') {
        select.value = 'openDate|desc';
      } else if (select.id === 'rows-select') {
        select.value = '5000';
      } else if (select.id === 'status-select') {
        select.value = 'forecasted|posted';
      } else {
        select.value = '';
      }
    });
  }

  private getFilters(): SearchFilters {
    const getSelectValue = (id: string): string => {
      const select = this.container.querySelector(`#${id}`) as HTMLSelectElement;
      return select?.value || '';
    };

    const getInputValue = (id: string): string => {
      const input = this.container.querySelector(`#${id}`) as HTMLInputElement;
      return input?.value?.trim() || '';
    };

    return {
      keyword: this.input.value.trim(),
      cfda: getInputValue('cfda-input'),
      agencies: getSelectValue('agencies-select'),
      sortBy: getSelectValue('sort-select'),
      rows: parseInt(getSelectValue('rows-select')),
      eligibilities: getSelectValue('eligibilities-select'),
      fundingCategories: getSelectValue('funding-categories-select'),
      fundingInstruments: getSelectValue('funding-instruments-select'),
      dateRange: getSelectValue('date-range-select'),
      oppStatuses: getSelectValue('status-select')
    };
  }

  private handleSearch(): void {
    const filters = this.getFilters();
    this.onSearch(filters);
  }

  private handleStateSearch(): void {
    const state = this.stateSelect?.value || '';
    if (!state) return;
    if (this.onStateSearch) this.onStateSearch(state);
  }

  setLoading(isLoading: boolean): void {
    this.button.disabled = isLoading;
    this.button.textContent = isLoading ? 'Searching...' : 'Search';
    this.input.disabled = isLoading;
    this.showFiltersButton.disabled = isLoading;
  }

  getElement(): HTMLElement {
    return this.container;
  }

  focus(): void {
    this.input.focus();
  }

  setMode(isStateMode: boolean): void {
    this.isStateMode = isStateMode;
    // Toggle visibility and placeholders
    if (this.stateSelect) {
      this.stateSelect.style.display = isStateMode ? 'block' : 'none';
    }
    this.input.placeholder = isStateMode
      ? 'Optional: ask a question (disabled for now)'
      : 'Search grants by keyword...';
    // Disable filters in state mode
    this.showFiltersButton.style.display = isStateMode ? 'none' : 'inline-block';
    this.filtersPanel.style.display = isStateMode ? 'none' : (this.filtersVisible ? 'block' : 'none');
  }

  private getStates(): string[] {
    return [
      'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','District of Columbia','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'
    ];
  }
}