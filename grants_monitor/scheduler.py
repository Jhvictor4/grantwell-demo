from __future__ import annotations
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import asyncio

from .service import run_many_states


scheduler: AsyncIOScheduler | None = None


def start_scheduler(cron: str = "0 6 * * *"):
    global scheduler
    if scheduler:
        return scheduler

    scheduler = AsyncIOScheduler()

    @scheduler.scheduled_job(CronTrigger.from_crontab(cron))
    def scheduled_scan():
        asyncio.create_task(run_many_states())

    scheduler.start()
    return scheduler