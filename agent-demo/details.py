import argparse
import asyncio
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()
from browser_use import Agent, Controller
from browser_use.llm import ChatOpenAI
from browser_use.mcp import MCPClient

# Resolve project root dynamically (one level up from this file directory)
BASE_DIR = str(Path(__file__).resolve().parent.parent)

# Where to append results (relative to BASE_DIR for filesystem MCP)
RESULT_JSON = "agent-demo/result.json"

EXECUTE_SEARCH_PROMPT = f"""
You will be provided a grant search website URL and a keyword. Your task is to:
1. Navigate ONLY to the provided website URL.
2. Find the grant search input/form. If there are multiple, choose the most relevant for grants.
3. Enter the keyword and execute the search.
4. When results load, extract up to the requested max_results entries, capturing for each:
   - title: grant opportunity name
   - open_date: the opening date for applications (or the closest equivalent such as "posted", "opens", or similar)
   - link: absolute URL to the grant detail page
5. Build a JSON object exactly in this shape:
{{
  "site": "<provided site URL>",
  "query": "<provided keyword>",
  "results": [
    {{ "title": "...", "open_date": "...", "link": "..." }}
  ]
}}
6. Use the filesystem MCP to append ONLY this JSON object (no extra commentary) to {RESULT_JSON}. Append as a single line JSON object.
7. If you cannot find a usable search form or no results, append an object with an empty results array instead.
"""

async def main():
    parser = argparse.ArgumentParser(description="Execute a grant search on a given website and save results.")
    parser.add_argument("--site", required=True, help="Grant search website URL")
    parser.add_argument("--keyword", required=True, help="Keyword to search for")
    parser.add_argument("--max-results", type=int, default=5, help="Maximum number of results to extract")
    args = parser.parse_args()

    controller = Controller()
    filesystem_client = MCPClient(
        server_name="filesystem",
        command="npx",
        args=["-y", "@modelcontextprotocol/server-filesystem", BASE_DIR]
    )

    await filesystem_client.connect()
    await filesystem_client.register_to_controller(controller)

    task = f"""
{EXECUTE_SEARCH_PROMPT}
---
site: {args.site}
keyword: {args.keyword}
max_results: {args.max_results}
"""

    agent = Agent(
        task=task,
        llm=ChatOpenAI(model="gpt-5", temperature=1.0),
        controller=controller,
    )

    try:
        # Abort if the run hangs beyond 10 seconds
        await asyncio.wait_for(agent.run(), timeout=10)
    except asyncio.TimeoutError:
        # Timed out per policy; do not hang
        pass
    finally:
        await filesystem_client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())