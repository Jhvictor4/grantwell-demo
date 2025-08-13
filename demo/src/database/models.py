from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

Base = declarative_base()

class Grant(Base):
    __tablename__ = 'grants'
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    agency = Column(String(200), nullable=False)
    opportunity_number = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    eligibility = Column(Text)
    funding_amount = Column(String(200))
    deadline = Column(DateTime)
    url = Column(String(500))
    source = Column(String(50), default='grants.gov')
    state = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ScrapingLog(Base):
    __tablename__ = 'scraping_logs'
    
    id = Column(Integer, primary_key=True, index=True)
    source = Column(String(100), nullable=False)
    status = Column(String(50), nullable=False)
    records_found = Column(Integer, default=0)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

DATABASE_URL = "sqlite:///./data/grants.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def create_tables():
    os.makedirs('data', exist_ok=True)
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()