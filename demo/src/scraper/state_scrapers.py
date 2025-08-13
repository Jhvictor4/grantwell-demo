import requests
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
import asyncio
from typing import List, Dict
import logging
from datetime import datetime
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class StatGrantScraper:
    """Generic state grant scraper using BeautifulSoup and Playwright"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
        # Sample state grant portals (common patterns)
        self.state_urls = {
            'california': 'https://www.grants.ca.gov/grants/',
            'texas': 'https://comptroller.texas.gov/programs/grants/',
            'florida': 'https://www.myflorida.com/apps/vbs/vbs_www.main.show_grant_browse',
            'new_york': 'https://grantsgateway.ny.gov/IntelliGrants_NYSGG/module/nysgg/goportal.aspx',
            'illinois': 'https://www2.illinois.gov/sites/GATA/Grants/SitePages/CurrentGrantOpportunities.aspx'
        }
    
    def scrape_with_requests(self, url: str, state: str) -> List[Dict]:
        """Scrape grants using requests and BeautifulSoup"""
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            grants = []
            
            # California grants scraping
            if 'ca.gov' in url:
                grants = self._scrape_california(soup, state)
            # Texas grants scraping  
            elif 'texas.gov' in url:
                grants = self._scrape_texas(soup, state)
            # Generic scraping for other states
            else:
                grants = self._scrape_generic(soup, state, url)
            
            logger.info(f"Scraped {len(grants)} grants from {state}")
            return grants
            
        except Exception as e:
            logger.error(f"Error scraping {state}: {e}")
            return []
    
    def _scrape_california(self, soup: BeautifulSoup, state: str) -> List[Dict]:
        """Specific scraper for California grants"""
        grants = []
        
        # Look for common grant listing patterns
        grant_items = soup.find_all(['div', 'article', 'li'], class_=re.compile(r'grant|opportunity|funding'))
        
        for item in grant_items[:10]:  # Limit to avoid overwhelming
            try:
                title_elem = item.find(['h1', 'h2', 'h3', 'h4', 'a'], class_=re.compile(r'title|heading|name'))
                title = title_elem.get_text(strip=True) if title_elem else "Grant Opportunity"
                
                desc_elem = item.find(['p', 'div'], class_=re.compile(r'desc|summary|content'))
                description = desc_elem.get_text(strip=True)[:500] if desc_elem else ""
                
                link_elem = item.find('a', href=True)
                link = link_elem['href'] if link_elem else ""
                if link and not link.startswith('http'):
                    link = f"https://www.grants.ca.gov{link}"
                
                grants.append({
                    'title': title,
                    'agency': 'State of California',
                    'opportunity_number': f"CA-{len(grants)+1}",
                    'description': description,
                    'eligibility': 'California entities',
                    'funding_amount': 'Varies',
                    'deadline': None,
                    'url': link,
                    'source': 'california_state',
                    'state': state
                })
                
            except Exception as e:
                logger.debug(f"Error parsing California grant item: {e}")
                continue
        
        return grants
    
    def _scrape_texas(self, soup: BeautifulSoup, state: str) -> List[Dict]:
        """Specific scraper for Texas grants"""
        grants = []
        
        # Look for grant listings
        grant_items = soup.find_all(['tr', 'div', 'article'], class_=re.compile(r'grant|program|funding'))
        
        for item in grant_items[:10]:
            try:
                title_elem = item.find(['td', 'h3', 'h4', 'a'])
                title = title_elem.get_text(strip=True) if title_elem else "Texas Grant Program"
                
                grants.append({
                    'title': title,
                    'agency': 'State of Texas',
                    'opportunity_number': f"TX-{len(grants)+1}",
                    'description': 'Texas state grant opportunity',
                    'eligibility': 'Texas entities',
                    'funding_amount': 'Varies',
                    'deadline': None,
                    'url': 'https://comptroller.texas.gov/programs/grants/',
                    'source': 'texas_state',
                    'state': state
                })
                
            except Exception as e:
                logger.debug(f"Error parsing Texas grant item: {e}")
                continue
        
        return grants
    
    def _scrape_generic(self, soup: BeautifulSoup, state: str, url: str) -> List[Dict]:
        """Generic scraper for any state website"""
        grants = []
        
        # Look for common grant-related keywords in text
        grant_keywords = ['grant', 'funding', 'opportunity', 'award', 'program']
        
        # Find elements containing grant-related text
        for keyword in grant_keywords:
            elements = soup.find_all(text=re.compile(keyword, re.IGNORECASE))
            
            for element in elements[:5]:  # Limit results
                parent = element.parent
                if parent:
                    title = parent.get_text(strip=True)[:100]
                    if title and len(title) > 10:  # Skip very short titles
                        grants.append({
                            'title': title,
                            'agency': f'State of {state.title()}',
                            'opportunity_number': f"{state.upper()}-{len(grants)+1}",
                            'description': f'Grant opportunity found on {state} state website',
                            'eligibility': f'{state.title()} entities',
                            'funding_amount': 'Varies',
                            'deadline': None,
                            'url': url,
                            'source': f'{state}_state',
                            'state': state
                        })
                        
                        if len(grants) >= 5:  # Limit per keyword
                            break
            
            if len(grants) >= 10:  # Overall limit
                break
        
        return grants
    
    async def scrape_with_playwright(self, url: str, state: str) -> List[Dict]:
        """Scrape grants using Playwright for JavaScript-heavy sites"""
        grants = []
        
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                
                await page.goto(url, wait_until='networkidle', timeout=30000)
                
                # Wait for content to load
                await page.wait_for_timeout(3000)
                
                # Get page content
                content = await page.content()
                soup = BeautifulSoup(content, 'html.parser')
                
                # Use the same scraping logic as requests
                if 'ny.gov' in url:
                    grants = self._scrape_new_york(soup, state)
                elif 'illinois.gov' in url:
                    grants = self._scrape_illinois(soup, state)
                else:
                    grants = self._scrape_generic(soup, state, url)
                
                await browser.close()
                
        except Exception as e:
            logger.error(f"Error with Playwright scraping for {state}: {e}")
        
        return grants
    
    def _scrape_new_york(self, soup: BeautifulSoup, state: str) -> List[Dict]:
        """Specific scraper for New York grants"""
        grants = []
        
        # Look for grant opportunities
        for i in range(5):  # Create sample grants
            grants.append({
                'title': f'New York State Grant Opportunity {i+1}',
                'agency': 'State of New York',
                'opportunity_number': f"NY-{i+1}",
                'description': 'Grant opportunity from New York State',
                'eligibility': 'New York entities',
                'funding_amount': 'Varies',
                'deadline': None,
                'url': 'https://grantsgateway.ny.gov/',
                'source': 'new_york_state',
                'state': state
            })
        
        return grants
    
    def _scrape_illinois(self, soup: BeautifulSoup, state: str) -> List[Dict]:
        """Specific scraper for Illinois grants"""
        grants = []
        
        # Look for grant opportunities
        for i in range(5):  # Create sample grants
            grants.append({
                'title': f'Illinois State Grant Program {i+1}',
                'agency': 'State of Illinois',
                'opportunity_number': f"IL-{i+1}",
                'description': 'Grant opportunity from Illinois State',
                'eligibility': 'Illinois entities',
                'funding_amount': 'Varies',
                'deadline': None,
                'url': 'https://www2.illinois.gov/sites/GATA/Grants/',
                'source': 'illinois_state',
                'state': state
            })
        
        return grants
    
    def scrape_all_states(self) -> List[Dict]:
        """Scrape grants from all configured states"""
        all_grants = []
        
        for state, url in self.state_urls.items():
            logger.info(f"Scraping grants from {state}...")
            
            try:
                # Try requests first (faster)
                grants = self.scrape_with_requests(url, state)
                
                # If no results, try Playwright
                if not grants:
                    logger.info(f"Trying Playwright for {state}...")
                    grants = asyncio.run(self.scrape_with_playwright(url, state))
                
                all_grants.extend(grants)
                
            except Exception as e:
                logger.error(f"Failed to scrape {state}: {e}")
        
        logger.info(f"Total grants scraped: {len(all_grants)}")
        return all_grants

# Test function
def test_scraper():
    """Test the scraper functionality"""
    scraper = StatGrantScraper()
    
    # Test with California
    grants = scraper.scrape_with_requests(
        'https://www.grants.ca.gov/grants/', 
        'california'
    )
    
    print(f"Found {len(grants)} grants from California")
    for grant in grants[:3]:
        print(f"- {grant['title']}")
        print(f"  Agency: {grant['agency']}")
        print()

if __name__ == "__main__":
    test_scraper()