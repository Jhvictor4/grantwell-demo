import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()

# Base paths
WORKSPACE_DIR = Path(os.getenv("WORKSPACE_DIR", "/workspace")).resolve()
DATA_DIR = WORKSPACE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Database
SQLITE_PATH = Path(os.getenv("SQLITE_PATH", str(DATA_DIR / "grants.db")))
DATABASE_URL = f"sqlite:///{SQLITE_PATH}"

# LLM
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai")  # only 'openai' supported initially
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Agent/runtime
AGENT_MAX_STEPS = int(os.getenv("AGENT_MAX_STEPS", "50"))
AGENT_STEP_TIMEOUT = int(os.getenv("AGENT_STEP_TIMEOUT", "180"))
AGENT_LLM_TIMEOUT = int(os.getenv("AGENT_LLM_TIMEOUT", "60"))
CONCURRENCY = int(os.getenv("CONCURRENCY", "4"))

# Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Save conversations for debugging
SAVE_CONVERSATIONS = os.getenv("SAVE_CONVERSATIONS", "true").lower() in {"1","true","yes","on"}
CONVERSATIONS_DIR = DATA_DIR / "conversations"
if SAVE_CONVERSATIONS:
    CONVERSATIONS_DIR.mkdir(parents=True, exist_ok=True)