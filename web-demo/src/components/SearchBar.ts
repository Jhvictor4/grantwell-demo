export class SearchBar {
  private container: HTMLElement;
  private input: HTMLInputElement;
  private button: HTMLButtonElement;
  private onSearch: (query: string) => void;

  constructor(onSearch: (query: string) => void) {
    this.onSearch = onSearch;
    this.container = this.createElement();
    this.input = this.container.querySelector('.search-input') as HTMLInputElement;
    this.button = this.container.querySelector('.search-button') as HTMLButtonElement;
    this.setupEventListeners();
  }

  private createElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'search-container';
    container.innerHTML = `
      <input 
        type="text" 
        class="search-input" 
        placeholder="Search grants by keyword..."
        autocomplete="off"
      />
      <button class="search-button" type="button">
        Search
      </button>
    `;
    return container;
  }

  private setupEventListeners(): void {
    this.button.addEventListener('click', () => {
      this.handleSearch();
    });

    this.input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleSearch();
      }
    });

    this.input.addEventListener('input', () => {
      // Auto-search on empty input to show all grants
      if (this.input.value.trim() === '') {
        this.handleSearch();
      }
    });
  }

  private handleSearch(): void {
    const query = this.input.value.trim();
    this.onSearch(query);
  }

  setLoading(isLoading: boolean): void {
    this.button.disabled = isLoading;
    this.button.textContent = isLoading ? 'Searching...' : 'Search';
    this.input.disabled = isLoading;
  }

  getElement(): HTMLElement {
    return this.container;
  }

  focus(): void {
    this.input.focus();
  }
}