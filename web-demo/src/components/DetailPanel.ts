import type { GrantDetail } from '../types/grants';
import { GrantsApiService } from '../services/grantsApi';

export class DetailPanel {
  private container: HTMLElement;
  private isOpen = false;

  constructor() {
    this.container = this.createElement();
    this.setupEventListeners();
  }

  private createElement(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'detail-panel';
    panel.innerHTML = `
      <div class="detail-header">
        <h2 class="detail-title">Grant Details</h2>
        <button class="close-button" type="button">&times;</button>
      </div>
      <div class="detail-content">
        <div class="loading">Select a grant to view details</div>
      </div>
    `;
    return panel;
  }

  private setupEventListeners(): void {
    const closeButton = this.container.querySelector('.close-button');
    closeButton?.addEventListener('click', () => {
      this.close();
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  async showDetail(oppId: string): Promise<void> {
    this.showLoading();
    this.open();

    try {
      const response = await GrantsApiService.getGrantDetails(oppId);
      
      if (response.errorcode !== 0 || !response.data) {
        throw new Error(response.msg || 'Failed to fetch grant details');
      }

      await this.renderDetail(response.data);
    } catch (error) {
      console.error('Error fetching grant details:', error);
      this.showError(error instanceof Error ? error.message : 'Failed to load details');
    }
  }

  private showLoading(): void {
    const content = this.container.querySelector('.detail-content')!;
    content.innerHTML = '<div class="loading">Loading details...</div>';
  }

  private showError(message: string): void {
    const content = this.container.querySelector('.detail-content')!;
    content.innerHTML = `<div class="empty">Error: ${message}</div>`;
  }

  private async renderDetail(detail: GrantDetail): Promise<void> {
    const content = this.container.querySelector('.detail-content')!;
    
    // Clean HTML content
    const cleanHTML = (html: string): string => {
      if (!html) return 'Not available';
      return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const formatCurrency = (amount: string | undefined): string => {
      if (!amount || amount === '0') return 'Not specified';
      const num = parseInt(amount);
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(num);
    };

    const formatDate = (dateStr: string): string => {
      if (!dateStr) return 'Not specified';
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          timeZone: 'UTC'
        });
      } catch {
        return dateStr;
      }
    };

    // Fetch related opportunities
    let relatedOppsHTML = '';
    try {
      const knnResponse = await GrantsApiService.getRelatedOpportunities(detail.opportunityNumber);
      if (knnResponse.response?.docs && knnResponse.response.docs.length > 0) {
        const relatedItems = knnResponse.response.docs
          .slice(0, 10) // Show top 10
          .map(doc => `
            <div class="related-item">
              <div class="related-number">${doc.opp_num}</div>
              <div class="related-id">ID: ${doc.opp_id}</div>
            </div>
          `).join('');
        
        relatedOppsHTML = `
          <div class="detail-section">
            <div class="section-header">
              <h3>🔗 Related Opportunities</h3>
              <span class="section-subtitle">AI-suggested similar grants</span>
            </div>
            <div class="related-opportunities">
              ${relatedItems}
            </div>
          </div>
        `;
      }
    } catch (error) {
      console.warn('Failed to fetch related opportunities:', error);
    }

    content.innerHTML = `
      <!-- Overview Section -->
      <div class="detail-section">
        <div class="section-header">
          <h3>📋 Overview</h3>
          <span class="section-subtitle">Grant summary and key information</span>
        </div>
        <div class="info-grid">
          <div class="info-card">
            <div class="info-label">Opportunity Number</div>
            <div class="info-value main-value">${detail.opportunityNumber}</div>
          </div>
          <div class="info-card">
            <div class="info-label">Category</div>
            <div class="info-value">${detail.opportunityCategory?.description || 'Not specified'}</div>
          </div>
          <div class="info-card">
            <div class="info-label">Status</div>
            <div class="info-value status-value">${detail.docType?.toUpperCase() || 'ACTIVE'}</div>
          </div>
        </div>
        <div class="title-section">
          <h4>${detail.opportunityTitle}</h4>
          <p class="description">${cleanHTML(detail.synopsis?.synopsisDesc || 'No description available').substring(0, 300)}${cleanHTML(detail.synopsis?.synopsisDesc || '').length > 300 ? '...' : ''}</p>
        </div>
      </div>

      <!-- Agency Information -->
      <div class="detail-section">
        <div class="section-header">
          <h3>🏛️ Agency Information</h3>
          <span class="section-subtitle">Funding organization details</span>
        </div>
        <div class="info-grid">
          <div class="info-card">
            <div class="info-label">Primary Agency</div>
            <div class="info-value">${detail.topAgencyDetails?.agencyName || 'Not specified'}</div>
            <div class="info-subvalue">${detail.topAgencyDetails?.agencyCode || ''}</div>
          </div>
          <div class="info-card">
            <div class="info-label">Sub Agency</div>
            <div class="info-value">${detail.agencyDetails?.agencyName || 'Not specified'}</div>
            <div class="info-subvalue">${detail.agencyDetails?.agencyCode || ''}</div>
          </div>
        </div>
        ${detail.synopsis?.agencyContactEmail ? `
          <div class="contact-info">
            <h4>📞 Contact Information</h4>
            <div class="contact-grid">
              <div class="contact-item">
                <span class="contact-label">Name:</span>
                <span class="contact-value">${detail.synopsis.agencyContactName || 'Not specified'}</span>
              </div>
              <div class="contact-item">
                <span class="contact-label">Email:</span>
                <span class="contact-value">${detail.synopsis.agencyContactEmail}</span>
              </div>
              ${detail.synopsis.agencyContactPhone ? `
                <div class="contact-item">
                  <span class="contact-label">Phone:</span>
                  <span class="contact-value">${detail.synopsis.agencyContactPhone}</span>
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Financial Information -->
      <div class="detail-section">
        <div class="section-header">
          <h3>💰 Financial Details</h3>
          <span class="section-subtitle">Award amounts and funding information</span>
        </div>
        <div class="info-grid">
          <div class="info-card highlight">
            <div class="info-label">Total Available</div>
            <div class="info-value large-value">${formatCurrency(detail.synopsis?.estimatedFunding)}</div>
          </div>
          <div class="info-card">
            <div class="info-label">Award Range</div>
            <div class="info-value">
              ${formatCurrency(detail.synopsis?.awardFloor)} - ${formatCurrency(detail.synopsis?.awardCeiling)}
            </div>
          </div>
          <div class="info-card">
            <div class="info-label">Expected Awards</div>
            <div class="info-value">${detail.synopsis?.numberOfAwards || 'Not specified'}</div>
          </div>
          <div class="info-card">
            <div class="info-label">Cost Sharing</div>
            <div class="info-value">${detail.synopsis?.costSharing ? 'Required' : 'Not required'}</div>
          </div>
        </div>
      </div>

      <!-- Important Dates -->
      <div class="detail-section">
        <div class="section-header">
          <h3>📅 Important Dates</h3>
          <span class="section-subtitle">Key deadlines and timeline</span>
        </div>
        <div class="info-grid">
          <div class="info-card">
            <div class="info-label">Posted Date</div>
            <div class="info-value">${formatDate(detail.synopsis?.postingDate || '')}</div>
          </div>
          <div class="info-card highlight">
            <div class="info-label">Application Deadline</div>
            <div class="info-value deadline-value">${formatDate(detail.synopsis?.responseDate || '')}</div>
          </div>
          <div class="info-card">
            <div class="info-label">Archive Date</div>
            <div class="info-value">${formatDate(detail.synopsis?.archiveDate || '')}</div>
          </div>
          <div class="info-card">
            <div class="info-label">Last Updated</div>
            <div class="info-value">${formatDate(detail.synopsis?.lastUpdatedDate || '')}</div>
          </div>
        </div>
      </div>

      <!-- Eligibility & Requirements -->
      <div class="detail-section">
        <div class="section-header">
          <h3>✅ Eligibility & Requirements</h3>
          <span class="section-subtitle">Who can apply and funding requirements</span>
        </div>
        ${detail.synopsis?.applicantEligibilityDesc ? `
          <div class="eligibility-desc">
            <h4>Eligibility Description</h4>
            <p>${cleanHTML(detail.synopsis.applicantEligibilityDesc)}</p>
          </div>
        ` : ''}
        ${detail.synopsis?.applicantTypes && detail.synopsis.applicantTypes.length > 0 ? `
          <div class="applicant-types">
            <h4>Eligible Applicant Types</h4>
            <div class="type-tags">
              ${detail.synopsis.applicantTypes.map(type => `
                <span class="type-tag">${type.description}</span>
              `).join('')}
            </div>
          </div>
        ` : ''}
        ${detail.synopsis?.fundingInstruments && detail.synopsis.fundingInstruments.length > 0 ? `
          <div class="funding-instruments">
            <h4>Funding Instruments</h4>
            <div class="instrument-tags">
              ${detail.synopsis.fundingInstruments.map(instrument => `
                <span class="instrument-tag">${instrument.description}</span>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Program Details -->
      ${detail.cfdas && detail.cfdas.length > 0 ? `
        <div class="detail-section">
          <div class="section-header">
            <h3>📑 Program Information</h3>
            <span class="section-subtitle">CFDA and program classifications</span>
          </div>
          <div class="cfda-list">
            ${detail.cfdas.map(cfda => `
              <div class="cfda-item">
                <div class="cfda-number">${cfda.cfdaNumber}</div>
                <div class="cfda-title">${cfda.programTitle}</div>
              </div>
            `).join('')}
          </div>
          <div class="program-category">
            <strong>Activity Category:</strong> ${detail.synopsis?.fundingActivityCategoryDesc || 'Not specified'}
          </div>
        </div>
      ` : ''}

      <!-- Attachments -->
      ${detail.synopsisAttachmentFolders && detail.synopsisAttachmentFolders.length > 0 ? `
        <div class="detail-section">
          <div class="section-header">
            <h3>📎 Attachments</h3>
            <span class="section-subtitle">Supporting documents and files</span>
          </div>
          ${detail.synopsisAttachmentFolders.map(folder => `
            <div class="attachment-folder">
              <h4>${folder.folderType} - ${folder.folderName}</h4>
              <div class="attachments-list">
                ${folder.synopsisAttachments.map(attachment => `
                  <div class="attachment-item">
                    <div class="attachment-icon">📄</div>
                    <div class="attachment-info">
                      <div class="attachment-name">${attachment.fileName}</div>
                      <div class="attachment-meta">
                        ${attachment.fileDescription} • ${Math.round(attachment.fileLobSize / 1024)} KB
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Additional Links -->
      ${(detail.synopsis?.fundingDescLinkUrl || (detail.synopsisDocumentURLs && detail.synopsisDocumentURLs.length > 0)) ? `
        <div class="detail-section">
          <div class="section-header">
            <h3>🔗 Additional Information</h3>
            <span class="section-subtitle">External resources and links</span>
          </div>
          <div class="external-link">
            ${detail.synopsis?.fundingDescLinkUrl ? `
              <a href="${detail.synopsis.fundingDescLinkUrl}" target="_blank" rel="noopener noreferrer">
                🌐 ${detail.synopsis.fundingDescLinkDesc || 'View Full Announcement'}
              </a>
            ` : ''}
            ${detail.synopsisDocumentURLs ? detail.synopsisDocumentURLs.map(docUrl => `
              <a href="${docUrl.docUrl}" target="_blank" rel="noopener noreferrer">
                📄 ${docUrl.description}
              </a>
            `).join('') : ''}
          </div>
        </div>
      ` : ''}

      ${relatedOppsHTML}

      <!-- Built-in Related Opportunities -->
      ${detail.relatedOpps && detail.relatedOpps.length > 0 ? `
        <div class="detail-section">
          <div class="section-header">
            <h3>🔄 Agency Related Opportunities</h3>
            <span class="section-subtitle">Other opportunities from the same agency</span>
          </div>
          <div class="agency-related-list">
            ${detail.relatedOpps.map(relatedOpp => `
              <div class="agency-related-item">
                <div class="related-title">${relatedOpp.opportunityTitle}</div>
                <div class="related-meta">
                  <span class="related-number">${relatedOpp.opportunityNum}</span>
                  <span class="related-dates">Posted: ${formatDate(relatedOpp.postedDate)} • Close: ${formatDate(relatedOpp.closeDate)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;
  }

  private open(): void {
    this.isOpen = true;
    this.container.classList.add('open');
    
    // Update main content margin
    const resultsPanel = document.querySelector('.results-panel');
    resultsPanel?.classList.add('detail-open');
  }

  close(): void {
    this.isOpen = false;
    this.container.classList.remove('open');
    
    // Remove main content margin
    const resultsPanel = document.querySelector('.results-panel');
    resultsPanel?.classList.remove('detail-open');
  }

  getElement(): HTMLElement {
    return this.container;
  }

  getIsOpen(): boolean {
    return this.isOpen;
  }
}