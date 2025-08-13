from __future__ import annotations
from datetime import datetime, date
from pathlib import Path
from typing import Optional

from sqlalchemy import (
    create_engine, String, Date, DateTime, Integer, Text, Boolean, UniqueConstraint, func
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from .config import DATABASE_URL, SQLITE_PATH


class Base(DeclarativeBase):
    pass


class State(Base):
    __tablename__ = "states"

    code: Mapped[str] = mapped_column(String(2), primary_key=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    seed_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Grant(Base):
    __tablename__ = "grants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    state_code: Mapped[str] = mapped_column(String(2))
    title: Mapped[str] = mapped_column(Text)
    url: Mapped[Optional[str]] = mapped_column(Text)
    program: Mapped[Optional[str]] = mapped_column(Text)
    agency: Mapped[Optional[str]] = mapped_column(Text)
    announcement_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    deadline: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    first_detected_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    last_detected_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    content_hash: Mapped[str] = mapped_column(String(64))

    __table_args__ = (
        UniqueConstraint("state_code", "title", "url", name="uq_state_title_url"),
    )


class Run(Base):
    __tablename__ = "runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    state_code: Mapped[str] = mapped_column(String(2))
    started_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    success: Mapped[bool] = mapped_column(Boolean, default=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    num_grants_found: Mapped[int] = mapped_column(Integer, default=0)
    page_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_updated_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


engine = create_engine(DATABASE_URL, future=True, echo=False)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def init_db(prepopulate_states: bool = True):
    # Ensure parent dir exists
    Path(SQLITE_PATH).parent.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)

    if prepopulate_states:
        from .states import US_STATES
        with SessionLocal() as session:
            existing = {s.code for s in session.query(State).all()}
            for s in US_STATES:
                if s["code"] not in existing:
                    session.add(State(code=s["code"], name=s["name"], seed_url=s.get("seed_url")))
            session.commit()