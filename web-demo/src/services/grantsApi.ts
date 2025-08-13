import type { SearchRequest, SearchResponse, DetailResponse, KNNResponse, GrantDetail } from '../types/grants';

const SEARCH_API = 'https://micro.grants.gov/rest/opportunities/search';
const DETAIL_API = 'https://apply07.grants.gov/grantsws/rest/opportunity/details';
const KNN_API = 'https://apply07.grants.gov/grantsws/rest/knn/relatedOpps';

export class GrantsApiService {
  static async searchGrants(keyword: string = ''): Promise<SearchResponse> {
    const request: SearchRequest = {
      keyword: keyword || null,
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

    try {
      const response = await fetch(SEARCH_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: SearchResponse = await response.json();
      
      // Handle case where API returns error messages array
      if (data.errorMsgs && data.errorMsgs.length > 0) {
        throw new Error(data.errorMsgs.join('; '));
      }
      
      return data;
    } catch (error) {
      console.error('Error searching grants:', error);
      throw error;
    }
  }

  static async getGrantDetails(oppId: string): Promise<DetailResponse> {
    const params = new URLSearchParams();
    params.append('oppId', oppId);

    try {
      const response = await fetch(DETAIL_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        },
        body: params
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: GrantDetail = await response.json();
      
      // Wrap the direct response in the expected format
      return {
        data: data,
        errorcode: 0,
        msg: 'Success'
      };
    } catch (error) {
      console.error('Error fetching grant details:', error);
      throw error;
    }
  }

  static async getRelatedOpportunities(oppNum: string): Promise<KNNResponse> {
    try {
      const response = await fetch(`${KNN_API}?opp_num=${encodeURIComponent(oppNum)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: KNNResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching related opportunities:', error);
      throw error;
    }
  }
}