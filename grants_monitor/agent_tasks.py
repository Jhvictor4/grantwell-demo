from __future__ import annotations
from textwrap import dedent
from typing import Optional


def build_task_for_state(state_code: str, state_name: str, seed_url: Optional[str] = None) -> str:
    base = f"""
    You are a diligent government grant monitor. Your job is to find the latest official information about security-related grants in the state of {state_name} ({state_code}).

    Success criteria:
    - Prefer the official state websites (.gov or the state's primary domain), such as Homeland Security, Emergency Management, Public Safety, or Grants Management offices.
    - If a seed URL is provided, start there first. Otherwise, search the web to locate the official page that lists security, homeland security, or public safety grant opportunities and/or announcements.
    - Extract recent grant announcements with: title, URL, program, agency, announcement date, application deadline, and a 1-2 sentence summary.
    - Also capture the page URL scanned and any visible "last updated" or "posted" text on the page.
    - Avoid unofficial aggregator sites and avoid dead or outdated pages when a newer official page exists.

    Output strictly as structured data using the provided schema. Do not include any extra fields. If no relevant grants are visible, return an empty list.
    """.strip()

    steps = """
    Strategy:
    1) Navigate to the official state site.
    2) Locate a page that lists grants for security/homeland security/public safety.
    3) If the page links to detailed grant pages or PDFs, open the most recent ones.
    4) Extract the fields accurately. Convert dates to ISO format when possible.
    5) Return the structured output.
    """.strip()

    if seed_url:
        start = f"Start at this page first: {seed_url}"
    else:
        start = (
            "If no seed URL is provided, use a search engine to find the official state page. "
            "Examples of good search queries: 'site:.gov homeland security grants {state_name}' or 'site:.gov public safety grants {state_name}'."
        )

    return dedent(f"""
    {base}

    {steps}

    {start}
    """)