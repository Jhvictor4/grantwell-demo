from __future__ import annotations
import asyncio
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

from browser_use import Agent

from .config import (
    AGENT_MAX_STEPS,
    SAVE_CONVERSATIONS,
    CONVERSATIONS_DIR,
    AGENT_LLM_TIMEOUT,
    AGENT_STEP_TIMEOUT,
)
from .schemas import GrantScanOutput, GrantItem
from .llm_provider import get_llm
from .agent_tasks import build_task_for_state
from .db import SessionLocal, Run, Grant, State


def _grant_hash(state_code: str, item: GrantItem) -> str:
    h = hashlib.sha1()
    content = f"{state_code}|{item.title}|{item.url or ''}|{item.program or ''}|{item.agency or ''}|{item.deadline or ''}"
    h.update(content.encode("utf-8"))
    return h.hexdigest()


async def run_state_scan(state_code: str) -> Tuple[bool, Optional[str], int]:
    """Run the Browser Use agent for a single state and store results. Returns (success, error, num_grants)."""
    # Load state info
    with SessionLocal() as session:
        state = session.get(State, state_code)
        if not state or not state.active:
            return False, f"State {state_code} not found or inactive", 0
        state_name = state.name
        seed_url = state.seed_url

    task_text = build_task_for_state(state_code, state_name, seed_url)

    # Prepare logging path
    conv_path: Optional[Path] = None
    if SAVE_CONVERSATIONS:
        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        conv_path = CONVERSATIONS_DIR / f"{state_code}_{ts}.md"

    llm = get_llm()
    agent = Agent(
        task=task_text,
        llm=llm,
        output_model_schema=GrantScanOutput,
        save_conversation_path=str(conv_path) if conv_path else None,
        use_vision=True,
        llm_timeout=AGENT_LLM_TIMEOUT,
        step_timeout=AGENT_STEP_TIMEOUT,
    )

    started_at = datetime.utcnow()
    success = False
    error_message: Optional[str] = None
    num_grants = 0
    page_url: Optional[str] = None
    last_updated_text: Optional[str] = None

    try:
        history = await agent.run(max_steps=AGENT_MAX_STEPS)
        structured_getter = getattr(history, "structured_output", None)
        structured: Optional[GrantScanOutput] = structured_getter() if callable(structured_getter) else None
        if structured:
            page_url = structured.page_url
            last_updated_text = structured.last_updated_text
            items = structured.grants or []
            num_grants = len(items)

            # Persist results
            with SessionLocal() as session:
                run = Run(
                    state_code=state_code,
                    started_at=started_at,
                    completed_at=datetime.utcnow(),
                    success=True,
                    num_grants_found=num_grants,
                    page_url=page_url,
                    last_updated_text=last_updated_text,
                )
                session.add(run)
                session.flush()

                for item in items:
                    try:
                        content_hash = _grant_hash(state_code, item)
                        # Upsert-like behavior
                        existing = (
                            session.query(Grant)
                            .filter(Grant.state_code == state_code, Grant.title == item.title, Grant.url == item.url)
                            .one_or_none()
                        )
                        if existing:
                            existing.program = item.program
                            existing.agency = item.agency
                            existing.announcement_date = item.announcement_date
                            existing.deadline = item.deadline
                            existing.summary = item.summary
                            existing.last_detected_at = datetime.utcnow()
                            existing.content_hash = content_hash
                        else:
                            session.add(
                                Grant(
                                    state_code=state_code,
                                    title=item.title,
                                    url=item.url,
                                    program=item.program,
                                    agency=item.agency,
                                    announcement_date=item.announcement_date,
                                    deadline=item.deadline,
                                    summary=item.summary,
                                    content_hash=content_hash,
                                )
                            )
                    except Exception:
                        # Skip malformed item but continue
                        continue

                session.commit()

        success = True
    except Exception as e:
        error_message = str(e)
        with SessionLocal() as session:
            run = Run(
                state_code=state_code,
                started_at=started_at,
                completed_at=datetime.utcnow(),
                success=False,
                error_message=error_message,
            )
            session.add(run)
            session.commit()

    return success, error_message, num_grants