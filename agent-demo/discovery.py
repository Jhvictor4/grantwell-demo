import asyncio
from dotenv import load_dotenv
load_dotenv()
from browser_use import Agent, Controller
from browser_use.llm import ChatOpenAI
from browser_use.mcp import MCPClient

BASE_DIR = "/Users/kangjihyeok/Documents/Github/grantwell-demo"
RESULT_JSON = "result.json"
EXPLORE_PROMPT = f"""
You will be provided the name of a U.S. state (one of the 51, including the District of Columbia). Your task is to locate the official or otherwise authoritative website where public safety grants or law‐enforcement funding opportunities for that state are listed. The url should contain actual information of grants and must provide a way to search for certain grants. Follow these rules:
1.	Search for the official website or state agency page that lists public safety grant opportunities. Prioritize government or official sources.
2.	Navigate to the website and verify that it contains an actual search form for grants. Do not stop until you find and interact with a search form.
3.	Once you've found a search form, you don't need to actually execute the search. If you can confirm the form exists and appears to be for searching grants, that's sufficient.
4.	You only need to verify that the website appears to have the capability to search for grants that would include:
   - Grant Opportunities
   - Open dates for grants
5.	Build a JSON object where the key is the state name and the value is another object containing the URL you found under the property public_safety_grants_url. The URL should be a direct link to the search form. Example:

{{
  "California": {{
    "public_safety_grants_url": "..."
  }}
}}

6.	If no relevant site exists or cannot be found, or if you cannot verify the presence of a working search form, return an empty object for that state name.
7.	Use filesystem MCP to append the result JSON object to {RESULT_JSON} — do not add any extra commentary or formatting.
"""

async def main():
    query = "Nevada"
    controller = Controller()
    filesystem_client = MCPClient(
        server_name="filesystem",
        command="npx",
        args=["-y", "@modelcontextprotocol/server-filesystem", BASE_DIR]
    )
    
    await filesystem_client.connect()
    await filesystem_client.register_to_controller(controller)
    
    agent = Agent(
        task=f"""
        {EXPLORE_PROMPT}
        ---
        query: {query}
        """,
        llm=ChatOpenAI(model="gpt-5", temperature=1.0),
        controller=controller,
    )
    
    await agent.run()
    await filesystem_client.disconnect()

asyncio.run(main())