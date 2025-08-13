import requests
import xml.etree.ElementTree as ET
from typing import List, Dict, Optional
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GrantsGovClient:
    """Grants.gov API client for fetching grant opportunities"""
    
    def __init__(self):
        self.base_url = "https://www.grants.gov/grantsws/rest/opportunities/search/"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'GrantsDemo/1.0 (Educational Purpose)',
            'Accept': 'application/json'
        })
    
    def search_grants(self, 
                     keyword: str = None,
                     agency: str = None,
                     limit: int = 25,
                     offset: int = 0) -> List[Dict]:
        """
        Search for grants using Grants.gov API
        
        Args:
            keyword: Search keyword
            agency: Agency name filter
            limit: Number of results to return (max 1000)
            offset: Offset for pagination
            
        Returns:
            List of grant dictionaries
        """
        try:
            params = {
                'format': 'json',
                'rows': min(limit, 1000),
                'start': offset
            }
            
            if keyword:
                params['keyword'] = keyword
            if agency:
                params['agency'] = agency
            
            # Add default filters for active opportunities
            params['status'] = 'open'
            
            url = f"{self.base_url}"
            logger.info(f"Searching grants with params: {params}")
            
            response = self.session.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            # Parse the response structure
            opportunities = []
            if 'response' in data and 'docs' in data['response']:
                for doc in data['response']['docs']:
                    opportunity = self._parse_opportunity(doc)
                    opportunities.append(opportunity)
            
            logger.info(f"Found {len(opportunities)} grant opportunities")
            return opportunities
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching grants: {e}")
            return []
        except Exception as e:
            logger.error(f"Error parsing grants data: {e}")
            return []
    
    def _parse_opportunity(self, doc: Dict) -> Dict:
        """Parse a single grant opportunity from API response"""
        
        # Helper function to safely get nested values
        def safe_get(data, key, default=""):
            return data.get(key, [default])[0] if isinstance(data.get(key), list) else data.get(key, default)
        
        try:
            return {
                'title': safe_get(doc, 'title'),
                'agency': safe_get(doc, 'agency'),
                'opportunity_number': safe_get(doc, 'opportunityNumber'),
                'description': safe_get(doc, 'description'),
                'eligibility': safe_get(doc, 'eligibility'),
                'funding_amount': safe_get(doc, 'awardCeiling') or safe_get(doc, 'estimatedTotalProgramFunding'),
                'deadline': self._parse_date(safe_get(doc, 'dueDate')),
                'url': f"https://www.grants.gov/search-results-detail/{safe_get(doc, 'opportunityNumber')}",
                'source': 'grants.gov'
            }
        except Exception as e:
            logger.error(f"Error parsing opportunity: {e}")
            return {}
    
    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse date string to datetime object"""
        if not date_str:
            return None
        
        try:
            # Try common date formats
            for fmt in ['%Y-%m-%dT%H:%M:%S.%fZ', '%Y-%m-%d', '%m/%d/%Y']:
                try:
                    return datetime.strptime(date_str, fmt)
                except ValueError:
                    continue
            return None
        except Exception:
            return None
    
    def get_opportunity_details(self, opportunity_number: str) -> Dict:
        """Get detailed information for a specific opportunity"""
        try:
            url = f"https://www.grants.gov/grantsws/rest/opportunity/{opportunity_number}"
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            if 'response' in data and 'docs' in data['response'] and data['response']['docs']:
                return self._parse_opportunity(data['response']['docs'][0])
            return {}
            
        except Exception as e:
            logger.error(f"Error fetching opportunity details: {e}")
            return {}

# Example usage and test function
def test_grants_client():
    """Test function to verify the client works"""
    client = GrantsGovClient()
    
    # Test basic search
    grants = client.search_grants(keyword="education", limit=5)
    
    print(f"Found {len(grants)} grants")
    for grant in grants[:3]:
        print(f"- {grant.get('title', 'N/A')}")
        print(f"  Agency: {grant.get('agency', 'N/A')}")
        print(f"  Number: {grant.get('opportunity_number', 'N/A')}")
        print()

if __name__ == "__main__":
    test_grants_client()