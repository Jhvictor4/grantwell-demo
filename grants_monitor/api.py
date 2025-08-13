from __future__ import annotations
from typing import List, Optional
from fastapi import FastAPI, BackgroundTasks, Query
from pydantic import BaseModel
from sqlalchemy import select, desc

from .db import init_db, SessionLocal, State, Grant, Run
from .service import run_many_states

app = FastAPI(title="US Security Grants Monitor", version="0.1.0")


@app.on_event("startup")
def _on_startup():
    init_db(prepopulate_states=True)


class RunResponse(BaseModel):
    results: List[dict]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/states")
def list_states():
    with SessionLocal() as session:
        rows = session.query(State).all()
        return [
            {"code": r.code, "name": r.name, "seed_url": r.seed_url, "active": r.active}
            for r in rows
        ]


@app.get("/grants")
def list_grants(state: Optional[str] = Query(None, description="2-letter state code")):
    with SessionLocal() as session:
        q = session.query(Grant)
        if state:
            q = q.filter(Grant.state_code == state)
        q = q.order_by(desc(Grant.last_detected_at)).limit(500)
        rows = q.all()
        return [
            {
                "id": r.id,
                "state_code": r.state_code,
                "title": r.title,
                "url": r.url,
                "program": r.program,
                "agency": r.agency,
                "announcement_date": r.announcement_date,
                "deadline": r.deadline,
                "summary": r.summary,
                "last_detected_at": r.last_detected_at,
            }
            for r in rows
        ]


@app.post("/run")
async def trigger_run(background_tasks: BackgroundTasks, states: Optional[List[str]] = None):
    async def job():
        await run_many_states(state_codes=states)

    background_tasks.add_task(job)
    return {"status": "started", "states": states}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)