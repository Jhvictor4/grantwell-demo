from __future__ import annotations
import asyncio
from typing import Iterable, List, Optional, Tuple

from .db import SessionLocal, init_db, State
from .runner import run_state_scan
from .config import CONCURRENCY


async def run_many_states(state_codes: Optional[Iterable[str]] = None, concurrency: int = CONCURRENCY) -> List[Tuple[str, bool, Optional[str], int]]:
    init_db(prepopulate_states=True)

    with SessionLocal() as session:
        if state_codes is None:
            states = [s.code for s in session.query(State).filter(State.active == True).all()]
        else:
            states = list(state_codes)

    semaphore = asyncio.Semaphore(concurrency)
    results: List[Tuple[str, bool, Optional[str], int]] = []

    async def _runner(code: str):
        async with semaphore:
            ok, err, n = await run_state_scan(code)
            results.append((code, ok, err, n))

    await asyncio.gather(*[_runner(code) for code in states])
    return results