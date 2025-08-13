from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import date, datetime


class GrantItem(BaseModel):
    title: str
    url: Optional[str] = None
    program: Optional[str] = None
    agency: Optional[str] = None
    announcement_date: Optional[date] = None
    deadline: Optional[date] = None
    summary: Optional[str] = None


class GrantScanOutput(BaseModel):
    page_url: Optional[str] = None
    last_updated_text: Optional[str] = None
    grants: List[GrantItem] = Field(default_factory=list)


class RunResult(BaseModel):
    state_code: str
    started_at: datetime
    completed_at: Optional[datetime]
    success: bool
    error_message: Optional[str] = None
    num_grants_found: int = 0


class StateInfo(BaseModel):
    code: str
    name: str
    seed_url: Optional[str] = None