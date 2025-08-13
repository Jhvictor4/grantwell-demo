import FirecrawlApp from '@mendable/firecrawl-js';

interface ErrorResponse {
  success: false;
  error: string;
}

interface CrawlStatusResponse {
  success: true;
  status: string;
  completed: number;
  total: number;
  creditsUsed: number;
  expiresAt: string;
  data: any[];
}

interface ScrapeResponse {
  success: true;
  data: {
    markdown: string;
    html: string;
    metadata: any;
    links: string[];
  };
}

type CrawlResponse = CrawlStatusResponse | ErrorResponse;
type ScrapeResponeType = ScrapeResponse | ErrorResponse;

export class FirecrawlService {
  private static API_KEY_STORAGE_KEY = 'firecrawl_api_key';
  private static firecrawlApp: FirecrawlApp | null = null;

  static saveApiKey(apiKey: string): void {
    localStorage.setItem(this.API_KEY_STORAGE_KEY, apiKey);
    this.firecrawlApp = new FirecrawlApp({ apiKey });
    console.log('Firecrawl API key saved successfully');
  }

  static getApiKey(): string | null {
    return localStorage.getItem(this.API_KEY_STORAGE_KEY);
  }

  static clearApiKey(): void {
    localStorage.removeItem(this.API_KEY_STORAGE_KEY);
    this.firecrawlApp = null;
  }

  static async testApiKey(apiKey: string): Promise<boolean> {
    try {
      console.log('Testing Firecrawl API key');
      this.firecrawlApp = new FirecrawlApp({ apiKey });
      // A simple test scrape to verify the API key
      const testResponse = await this.firecrawlApp.scrapeUrl('https://example.com', {
        formats: ['markdown'],
      });
      return testResponse.success;
    } catch (error) {
      console.error('Error testing Firecrawl API key:', error);
      return false;
    }
  }

  static async scrapeUrl(url: string, options: any = {}): Promise<{ success: boolean; error?: string; data?: any }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { success: false, error: 'Firecrawl API key not found' };
    }

    try {
      console.log('Scraping URL with Firecrawl:', url);
      if (!this.firecrawlApp) {
        this.firecrawlApp = new FirecrawlApp({ apiKey });
      }

      const scrapeResponse = await this.firecrawlApp.scrapeUrl(url, {
        formats: ['markdown', 'html'],
        ...options,
      }) as ScrapeResponeType;

      if (!scrapeResponse.success) {
        console.error('Scrape failed:', (scrapeResponse as ErrorResponse).error);
        return { 
          success: false, 
          error: (scrapeResponse as ErrorResponse).error || 'Failed to scrape URL' 
        };
      }

      console.log('Scrape successful');
      return { 
        success: true,
        data: scrapeResponse.data 
      };
    } catch (error) {
      console.error('Error during scrape:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to connect to Firecrawl API' 
      };
    }
  }

  static async crawlWebsite(url: string, options: any = {}): Promise<{ success: boolean; error?: string; data?: any }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { success: false, error: 'Firecrawl API key not found' };
    }

    try {
      console.log('Starting crawl with Firecrawl:', url);
      if (!this.firecrawlApp) {
        this.firecrawlApp = new FirecrawlApp({ apiKey });
      }

      const crawlResponse = await this.firecrawlApp.crawlUrl(url, {
        limit: 50,
        scrapeOptions: {
          formats: ['markdown', 'html'],
        },
        ...options,
      }) as CrawlResponse;

      if (!crawlResponse.success) {
        console.error('Crawl failed:', (crawlResponse as ErrorResponse).error);
        return { 
          success: false, 
          error: (crawlResponse as ErrorResponse).error || 'Failed to crawl website' 
        };
      }

      console.log('Crawl successful:', crawlResponse);
      return { 
        success: true,
        data: crawlResponse 
      };
    } catch (error) {
      console.error('Error during crawl:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to connect to Firecrawl API' 
      };
    }
  }

  static extractJustGrantsOpportunities(crawlData: any[]): any[] {
    const opportunities: any[] = [];

    crawlData.forEach((page) => {
      const { markdown, html, metadata, url } = page;
      
      // Extract opportunity data using regex patterns for common JustGrants formats
      const titleRegex = /(?:Opportunity Title|Grant Title|Program Name):\s*([^\n\r]+)/gi;
      const agencyRegex = /(?:Agency|Department|Office):\s*([^\n\r]+)/gi;
      const deadlineRegex = /(?:Deadline|Due Date|Closing Date):\s*([^\n\r]+)/gi;
      const amountRegex = /(?:Award Amount|Funding|Maximum Award):\s*\$?([\d,]+)/gi;
      const summaryRegex = /(?:Summary|Description|Overview):\s*([^\n\r]{50,500})/gi;

      let titleMatch, agencyMatch, deadlineMatch, amountMatch, summaryMatch;

      while ((titleMatch = titleRegex.exec(markdown)) !== null) {
        const opportunity = {
          opportunity_id: `${Date.now()}-${opportunities.length}`,
          title: titleMatch[1].trim(),
          agency: '',
          deadline: null,
          funding_amount_max: null,
          summary: '',
          full_content: markdown,
          source_url: url,
          metadata: metadata || {}
        };

        // Try to find corresponding agency, deadline, amount, and summary
        if ((agencyMatch = agencyRegex.exec(markdown)) !== null) {
          opportunity.agency = agencyMatch[1].trim();
        }

        if ((deadlineMatch = deadlineRegex.exec(markdown)) !== null) {
          try {
            opportunity.deadline = new Date(deadlineMatch[1].trim()).toISOString().split('T')[0];
          } catch (e) {
            console.warn('Could not parse deadline:', deadlineMatch[1]);
          }
        }

        if ((amountMatch = amountRegex.exec(markdown)) !== null) {
          try {
            opportunity.funding_amount_max = parseFloat(amountMatch[1].replace(/,/g, ''));
          } catch (e) {
            console.warn('Could not parse amount:', amountMatch[1]);
          }
        }

        if ((summaryMatch = summaryRegex.exec(markdown)) !== null) {
          opportunity.summary = summaryMatch[1].trim();
        }

        // Only add if we have a meaningful title
        if (opportunity.title.length > 10) {
          opportunities.push(opportunity);
        }
      }

      // Fallback: If no structured data found, try to extract from HTML/metadata
      if (opportunities.length === 0 && metadata?.title) {
        opportunities.push({
          opportunity_id: `${Date.now()}-${opportunities.length}`,
          title: metadata.title,
          agency: metadata.siteName || 'DOJ',
          deadline: null,
          funding_amount_max: null,
          summary: metadata.description || '',
          full_content: markdown,
          source_url: url,
          metadata: metadata || {}
        });
      }
    });

    return opportunities;
  }
}