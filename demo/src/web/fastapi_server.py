from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import sys
import os

# Add src to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from database.models import Grant, ScrapingLog, get_db, create_tables
from api.grants_client import GrantsGovClient
from scraper.state_scrapers import StatGrantScraper
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Grant Scraper API",
    description="API for scraping and managing grant opportunities",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database
create_tables()

# Initialize clients
grants_client = GrantsGovClient()
state_scraper = StatGrantScraper()

@app.on_event("startup")
async def startup_event():
    """Initialize the application"""
    logger.info("Starting Grant Scraper API...")
    create_tables()

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Grant Scraper API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow()}

@app.get("/grants/", response_model=List[dict])
async def get_grants(
    skip: int = 0,
    limit: int = 100,
    source: Optional[str] = None,
    state: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get grants from database with optional filtering"""
    try:
        query = db.query(Grant)
        
        if source:
            query = query.filter(Grant.source == source)
        if state:
            query = query.filter(Grant.state == state)
        
        grants = query.offset(skip).limit(limit).all()
        
        return [
            {
                "id": grant.id,
                "title": grant.title,
                "agency": grant.agency,
                "opportunity_number": grant.opportunity_number,
                "description": grant.description,
                "eligibility": grant.eligibility,
                "funding_amount": grant.funding_amount,
                "deadline": grant.deadline,
                "url": grant.url,
                "source": grant.source,
                "state": grant.state,
                "created_at": grant.created_at
            }
            for grant in grants
        ]
    except Exception as e:
        logger.error(f"Error fetching grants: {e}")
        raise HTTPException(status_code=500, detail="Error fetching grants")

@app.post("/scrape/grants-gov/")
async def scrape_grants_gov(
    background_tasks: BackgroundTasks,
    keyword: Optional[str] = None,
    agency: Optional[str] = None,
    limit: int = 25,
    db: Session = Depends(get_db)
):
    """Scrape grants from Grants.gov API"""
    def scrape_and_save():
        try:
            # Create scraping log
            log = ScrapingLog(
                source="grants.gov",
                status="started"
            )
            db.add(log)
            db.commit()
            
            # Fetch grants
            grants_data = grants_client.search_grants(
                keyword=keyword,
                agency=agency,
                limit=limit
            )
            
            saved_count = 0
            for grant_data in grants_data:
                if grant_data.get('opportunity_number'):
                    # Check if grant already exists
                    existing = db.query(Grant).filter(
                        Grant.opportunity_number == grant_data['opportunity_number']
                    ).first()
                    
                    if not existing:
                        grant = Grant(**grant_data)
                        db.add(grant)
                        saved_count += 1
            
            db.commit()
            
            # Update log
            log.status = "completed"
            log.records_found = saved_count
            db.commit()
            
            logger.info(f"Saved {saved_count} grants from Grants.gov")
            
        except Exception as e:
            logger.error(f"Error scraping Grants.gov: {e}")
            log.status = "failed"
            log.error_message = str(e)
            db.commit()
    
    background_tasks.add_task(scrape_and_save)
    return {"message": "Grants.gov scraping started", "status": "initiated"}

@app.post("/scrape/states/")
async def scrape_state_grants(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Scrape grants from state websites"""
    def scrape_and_save():
        try:
            # Create scraping log
            log = ScrapingLog(
                source="state_websites",
                status="started"
            )
            db.add(log)
            db.commit()
            
            # Fetch grants from all states
            grants_data = state_scraper.scrape_all_states()
            
            saved_count = 0
            for grant_data in grants_data:
                if grant_data.get('opportunity_number'):
                    # Check if grant already exists
                    existing = db.query(Grant).filter(
                        Grant.opportunity_number == grant_data['opportunity_number']
                    ).first()
                    
                    if not existing:
                        grant = Grant(**grant_data)
                        db.add(grant)
                        saved_count += 1
            
            db.commit()
            
            # Update log
            log.status = "completed"
            log.records_found = saved_count
            db.commit()
            
            logger.info(f"Saved {saved_count} grants from state websites")
            
        except Exception as e:
            logger.error(f"Error scraping state websites: {e}")
            log.status = "failed"
            log.error_message = str(e)
            db.commit()
    
    background_tasks.add_task(scrape_and_save)
    return {"message": "State website scraping started", "status": "initiated"}

@app.get("/scraping-logs/")
async def get_scraping_logs(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get scraping logs"""
    try:
        logs = db.query(ScrapingLog).order_by(
            ScrapingLog.created_at.desc()
        ).offset(skip).limit(limit).all()
        
        return [
            {
                "id": log.id,
                "source": log.source,
                "status": log.status,
                "records_found": log.records_found,
                "error_message": log.error_message,
                "created_at": log.created_at
            }
            for log in logs
        ]
    except Exception as e:
        logger.error(f"Error fetching logs: {e}")
        raise HTTPException(status_code=500, detail="Error fetching logs")

@app.get("/stats/")
async def get_stats(db: Session = Depends(get_db)):
    """Get database statistics"""
    try:
        total_grants = db.query(Grant).count()
        grants_by_source = db.query(Grant.source, db.func.count(Grant.id)).group_by(Grant.source).all()
        grants_by_state = db.query(Grant.state, db.func.count(Grant.id)).group_by(Grant.state).all()
        
        return {
            "total_grants": total_grants,
            "by_source": {source: count for source, count in grants_by_source},
            "by_state": {state: count for state, count in grants_by_state if state}
        }
    except Exception as e:
        logger.error(f"Error fetching stats: {e}")
        raise HTTPException(status_code=500, detail="Error fetching statistics")

@app.delete("/grants/clear/")
async def clear_grants(db: Session = Depends(get_db)):
    """Clear all grants from database (for demo purposes)"""
    try:
        deleted_count = db.query(Grant).delete()
        db.commit()
        return {"message": f"Cleared {deleted_count} grants from database"}
    except Exception as e:
        logger.error(f"Error clearing grants: {e}")
        raise HTTPException(status_code=500, detail="Error clearing grants")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)