import gradio as gr
import requests
import pandas as pd
import json
from datetime import datetime
import sys
import os

# Add src to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from src.database.models import create_tables
from src.api.grants_client import GrantsGovClient
from src.scraper.state_scrapers import StatGrantScraper

# FastAPI server URL
API_BASE_URL = "http://localhost:8000"

# Initialize components
create_tables()
grants_client = GrantsGovClient()
state_scraper = StatGrantScraper()

def get_grants_from_api(source_filter="", state_filter="", limit=50):
    """Fetch grants from FastAPI backend"""
    try:
        params = {"limit": limit}
        if source_filter:
            params["source"] = source_filter
        if state_filter:
            params["state"] = state_filter
        
        response = requests.get(f"{API_BASE_URL}/grants/", params=params, timeout=10)
        if response.status_code == 200:
            return response.json()
        else:
            return []
    except requests.exceptions.ConnectionError:
        # If API is not running, return empty list
        return []
    except Exception as e:
        print(f"Error fetching grants: {e}")
        return []

def format_grants_for_display(grants):
    """Format grants data for Gradio display"""
    if not grants:
        return pd.DataFrame({"Message": ["No grants found. Try scraping some data first!"]})
    
    df_data = []
    for grant in grants:
        df_data.append({
            "Title": grant.get("title", "N/A")[:80] + "..." if len(grant.get("title", "")) > 80 else grant.get("title", "N/A"),
            "Agency": grant.get("agency", "N/A"),
            "Source": grant.get("source", "N/A"),
            "State": grant.get("state", "N/A") or "N/A",
            "Funding": grant.get("funding_amount", "N/A"),
            "Number": grant.get("opportunity_number", "N/A"),
            "URL": grant.get("url", "N/A")
        })
    
    return pd.DataFrame(df_data)

def scrape_grants_gov(keyword, agency, limit):
    """Scrape grants from Grants.gov"""
    try:
        # Try API first
        try:
            data = {
                "keyword": keyword if keyword else None,
                "agency": agency if agency else None,
                "limit": int(limit)
            }
            response = requests.post(f"{API_BASE_URL}/scrape/grants-gov/", 
                                   json=data, timeout=30)
            if response.status_code == 200:
                return "✅ Grants.gov scraping started! Check the grants list in a few moments."
        except requests.exceptions.ConnectionError:
            pass
        
        # Fallback to direct scraping
        grants_data = grants_client.search_grants(
            keyword=keyword if keyword else None,
            agency=agency if agency else None,
            limit=int(limit)
        )
        
        if grants_data:
            return f"✅ Found {len(grants_data)} grants from Grants.gov (direct mode)"
        else:
            return "❌ No grants found from Grants.gov"
            
    except Exception as e:
        return f"❌ Error scraping Grants.gov: {str(e)}"

def scrape_state_websites():
    """Scrape grants from state websites"""
    try:
        # Try API first
        try:
            response = requests.post(f"{API_BASE_URL}/scrape/states/", timeout=30)
            if response.status_code == 200:
                return "✅ State website scraping started! This may take a few minutes."
        except requests.exceptions.ConnectionError:
            pass
        
        # Fallback to direct scraping
        grants_data = state_scraper.scrape_all_states()
        
        if grants_data:
            return f"✅ Found {len(grants_data)} grants from state websites (direct mode)"
        else:
            return "❌ No grants found from state websites"
            
    except Exception as e:
        return f"❌ Error scraping state websites: {str(e)}"

def get_stats():
    """Get database statistics"""
    try:
        response = requests.get(f"{API_BASE_URL}/stats/", timeout=10)
        if response.status_code == 200:
            stats = response.json()
            
            total = stats.get("total_grants", 0)
            by_source = stats.get("by_source", {})
            by_state = stats.get("by_state", {})
            
            stats_text = f"""
📊 **Database Statistics**

**Total Grants:** {total}

**By Source:**
{json.dumps(by_source, indent=2) if by_source else "No data"}

**By State (Top 10):**
{json.dumps(dict(list(by_state.items())[:10]), indent=2) if by_state else "No data"}
            """
            return stats_text
        else:
            return "❌ Could not fetch statistics"
    except requests.exceptions.ConnectionError:
        return "❌ FastAPI server is not running. Please start it first with: `python src/web/fastapi_server.py`"
    except Exception as e:
        return f"❌ Error fetching statistics: {str(e)}"

def clear_database():
    """Clear all grants from database"""
    try:
        response = requests.delete(f"{API_BASE_URL}/grants/clear/", timeout=10)
        if response.status_code == 200:
            result = response.json()
            return f"✅ {result.get('message', 'Database cleared')}"
        else:
            return "❌ Could not clear database"
    except requests.exceptions.ConnectionError:
        return "❌ FastAPI server is not running"
    except Exception as e:
        return f"❌ Error clearing database: {str(e)}"

def search_grants(source_filter, state_filter, limit):
    """Search and display grants"""
    grants = get_grants_from_api(source_filter, state_filter, int(limit))
    return format_grants_for_display(grants)

# Create Gradio interface
with gr.Blocks(title="Grant Scraper Demo", theme=gr.themes.Soft()) as demo:
    gr.Markdown("""
    # 🏛️ Grant Scraper Demo
    
    This demo showcases grant data collection from:
    - **Grants.gov API** - Federal grant opportunities
    - **State Websites** - Grant opportunities from various US states using web scraping
    
    **Instructions:**
    1. Start the FastAPI server: `python src/web/fastapi_server.py`
    2. Use the scraping functions to collect data
    3. View and search the collected grants
    """)
    
    with gr.Tabs():
        # Tab 1: Data Collection
        with gr.Tab("🔍 Data Collection"):
            gr.Markdown("### Grants.gov API Scraping")
            
            with gr.Row():
                with gr.Column():
                    keyword_input = gr.Textbox(
                        label="Keyword (optional)", 
                        placeholder="e.g., education, research, healthcare"
                    )
                    agency_input = gr.Textbox(
                        label="Agency (optional)", 
                        placeholder="e.g., National Science Foundation"
                    )
                    limit_input = gr.Number(
                        label="Limit", 
                        value=25, 
                        minimum=1, 
                        maximum=100
                    )
                
                with gr.Column():
                    scrape_btn = gr.Button("🚀 Scrape Grants.gov", variant="primary")
                    grants_result = gr.Textbox(label="Result", lines=3)
            
            scrape_btn.click(
                scrape_grants_gov, 
                inputs=[keyword_input, agency_input, limit_input], 
                outputs=grants_result
            )
            
            gr.Markdown("### State Websites Scraping")
            gr.Markdown("Scrapes grant opportunities from California, Texas, Florida, New York, and Illinois")
            
            with gr.Row():
                scrape_states_btn = gr.Button("🌎 Scrape State Websites", variant="secondary")
                states_result = gr.Textbox(label="Result", lines=3)
            
            scrape_states_btn.click(scrape_state_websites, outputs=states_result)
        
        # Tab 2: Data Viewing
        with gr.Tab("📊 View Grants"):
            gr.Markdown("### Search and Filter Grants")
            
            with gr.Row():
                source_filter = gr.Dropdown(
                    label="Source Filter",
                    choices=["", "grants.gov", "california_state", "texas_state", "florida_state", "new_york_state", "illinois_state"],
                    value=""
                )
                state_filter = gr.Dropdown(
                    label="State Filter",
                    choices=["", "california", "texas", "florida", "new_york", "illinois"],
                    value=""
                )
                search_limit = gr.Number(label="Limit", value=50, minimum=1, maximum=200)
                search_btn = gr.Button("🔍 Search Grants", variant="primary")
            
            grants_table = gr.Dataframe(
                label="Grant Opportunities",
                interactive=False,
                wrap=True,
                max_height=400
            )
            
            search_btn.click(
                search_grants,
                inputs=[source_filter, state_filter, search_limit],
                outputs=grants_table
            )
            
            # Auto-refresh on load
            demo.load(
                lambda: search_grants("", "", 50),
                outputs=grants_table
            )
        
        # Tab 3: Statistics
        with gr.Tab("📈 Statistics"):
            gr.Markdown("### Database Statistics")
            
            with gr.Row():
                stats_btn = gr.Button("📊 Get Statistics", variant="primary")
                clear_btn = gr.Button("🗑️ Clear Database", variant="stop")
            
            stats_output = gr.Markdown()
            clear_output = gr.Textbox(label="Clear Result")
            
            stats_btn.click(get_stats, outputs=stats_output)
            clear_btn.click(clear_database, outputs=clear_output)
            
            # Auto-load stats
            demo.load(get_stats, outputs=stats_output)
        
        # Tab 4: API Documentation
        with gr.Tab("📚 API Documentation"):
            gr.Markdown("""
            ### FastAPI Endpoints
            
            Start the FastAPI server with: `python src/web/fastapi_server.py`
            
            Then visit: [http://localhost:8000/docs](http://localhost:8000/docs)
            
            **Available Endpoints:**
            
            - `GET /grants/` - Get all grants with optional filtering
            - `POST /scrape/grants-gov/` - Scrape grants from Grants.gov
            - `POST /scrape/states/` - Scrape grants from state websites
            - `GET /stats/` - Get database statistics
            - `GET /scraping-logs/` - Get scraping operation logs
            - `DELETE /grants/clear/` - Clear all grants from database
            
            **Example Usage:**
            ```bash
            # Get all grants
            curl http://localhost:8000/grants/
            
            # Scrape from Grants.gov
            curl -X POST http://localhost:8000/scrape/grants-gov/ \\
                 -H "Content-Type: application/json" \\
                 -d '{"keyword": "education", "limit": 25}'
            
            # Get statistics
            curl http://localhost:8000/stats/
            ```
            """)

if __name__ == "__main__":
    print("🚀 Starting Grant Scraper Demo...")
    print("💡 Make sure to start the FastAPI server first:")
    print("   python src/web/fastapi_server.py")
    print()
    
    demo.launch(
        server_name="0.0.0.0",
        server_port=7860,
        share=False,
        show_error=True
    )