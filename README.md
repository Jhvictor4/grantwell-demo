US Security Grants Monitor (browser-use)

Overview
- AI browsing agents monitor all 51 US states (including DC) for security/public safety/homeland security grant updates using `browser-use` (Playwright + LLM).
- Results are saved to SQLite and exposed via a FastAPI API. A scheduler can run daily.

Prerequisites
- Python 3.11+ (this env has 3.13)
- Playwright browsers installed: `playwright install chromium --with-deps --no-shell`
- An LLM API key. Supported: OpenAI (default)

Quick Start
1) Environment
   - Copy `.env.example` to `.env` and set keys.
2) Install Python deps (already preinstalled here), otherwise:
   - `pip install -r requirements.txt` (or `pip install browser-use playwright fastapi uvicorn apscheduler aiosqlite pydantic sqlalchemy python-dotenv`)
3) Initialize DB and run once:
   - `python -m grants_monitor.run_once --states NY`  # quick smoke test
   - `python -m grants_monitor.run_once`              # run all states (can be slow/costly)
4) Run API:
   - `python -m grants_monitor.api` then open http://localhost:8000/docs

Configuration (.env)
- OPENAI_API_KEY=your_openai_key
- OPENAI_MODEL=gpt-4o  (defaults to gpt-4o)
- CONCURRENCY=4
- AGENT_MAX_STEPS=50
- SAVE_CONVERSATIONS=true

Notes
- Each run saves an optional conversation log under `data/conversations/` for debugging.
- The agent returns structured output per the `GrantScanOutput` schema. Storage deduplicates by (state, title, url).
- Consider increasing concurrency cautiously; headless browsers are resource-intensive.