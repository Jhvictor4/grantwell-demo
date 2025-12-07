# usacops_gradio_interactive.py
import time
import io
import re
import os, tempfile
import requests
import pandas as pd
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed
import gradio as gr

ROOT = "https://www.usacops.com"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; USACOPS-GradioMirror/2.0)",
    "Accept": "text/html, */*;q=0.1",
}

STATE_ORDER_BY_POP = [
    "CA","TX","FL","NY","PA","IL","OH","GA","NC","MI",
    "NJ","VA","WA","AZ","TN","MA","IN","MD","MO","WI",
    "CO","MN","SC","AL","LA","KY","OR","OK","CT","UT",
    "NV","IA","AR","KS","MS","NM","NE","ID","WV","HI",
    "NH","ME","MT","RI","DE","SD","ND","AK","VT","WY"
]

STATE_NAME_BY_ABBR = {
  'AL':'Alabama','AK':'Alaska','AZ':'Arizona','AR':'Arkansas','CA':'California',
  'CO':'Colorado','CT':'Connecticut','DE':'Delaware','FL':'Florida','GA':'Georgia',
  'HI':'Hawaii','ID':'Idaho','IL':'Illinois','IN':'Indiana','IA':'Iowa','KS':'Kansas',
  'KY':'Kentucky','LA':'Louisiana','ME':'Maine','MD':'Maryland','MA':'Massachusetts',
  'MI':'Michigan','MN':'Minnesota','MS':'Mississippi','MO':'Missouri','MT':'Montana',
  'NE':'Nebraska','NV':'Nevada','NH':'New Hampshire','NJ':'New Jersey','NM':'New Mexico',
  'NY':'New York','NC':'North Carolina','ND':'North Dakota','OH':'Ohio','OK':'Oklahoma',
  'OR':'Oregon','PA':'Pennsylvania','RI':'Rhode Island','SC':'South Carolina',
  'SD':'South Dakota','TN':'Tennessee','TX':'Texas','UT':'Utah','VT':'Vermont',
  'VA':'Virginia','WA':'Washington','WV':'West Virginia','WI':'Wisconsin','WY':'Wyoming'
}

PHONE_RE = re.compile(r"\(?\d{3}\)?\s*[-.\s]?\d{3}[-.\s]\d{4}")

# --- simple in-memory cache for list pages per state/kind
LIST_CACHE: dict[tuple[str, str], list[dict]] = {}

def http_get(url, retries=2, pause=0.4, timeout=15):
    for i in range(retries + 1):
        try:
            r = requests.get(url, headers=HEADERS, timeout=timeout)
            if 200 <= r.status_code < 300:
                return r.text
        except requests.RequestException:
            pass
        time.sleep(pause * (i + 1))
    return None

def absolutize(state_abbr: str, href: str) -> str:
    if href.startswith("http://") or href.startswith("https://"):
        return href
    if href.startswith("/"):
        return ROOT + href
    return f"{ROOT}/{state_abbr.lower()}/{href}"

def extract_list_candidates(list_html: str, kind: str, state_abbr: str):
    """
    리스트 페이지에서 상세 URL과 City 라벨만 뽑는다. (빠름)
    """
    results = []
    if not list_html:
        return results
    soup = BeautifulSoup(list_html, "html.parser")
    for a in soup.find_all("a", href=True):
        href = a["href"]
        label = a.get_text(strip=True).rstrip("*")
        if not (href.endswith("/") or "index.html" in href):
            continue
        url = absolutize(state_abbr, href)
        city = label if kind == "police" else ""  # sheriffs는 city 공란
        results.append({"url": url, "city": city, "kind": "Police" if kind=="police" else "Sheriff"})
    # 중복 제거
    seen, uniq = set(), []
    for c in results:
        if c["url"] not in seen:
            uniq.append(c); seen.add(c["url"])
    return uniq

def parse_department_page(html: str):
    """
    상세 페이지에서 department, phone, website, county 파싱
    """
    if not html:
        return {}
    soup = BeautifulSoup(html, "html.parser")
    text = " ".join(soup.get_text(" ", strip=True).split())

    # Department
    department = ""
    h1 = soup.find("h1")
    if h1 and h1.get_text(strip=True):
        department = h1.get_text(strip=True)
    if not department:
        strong = soup.find(["h2","strong","b"])
        if strong and strong.get_text(strip=True):
            department = strong.get_text(strip=True)

    # Phone
    phone = ""
    m = PHONE_RE.search(text)
    if m:
        phone = m.group(0)

    # Website
    website = ""
    for a in soup.find_all("a", href=True):
        t = a.get_text(" ", strip=True).lower()
        if ("website" in t) or ("homepage" in t) or ("official website" in t):
            website = a["href"]; break
    if not website:
        for a in soup.find_all("a", href=True):
            if a["href"].startswith("http"):
                website = a["href"]; break

    # County
    county = ""
    m = re.search(r"County:\s*([A-Za-z\s]+)", text)
    if m:
        county = m.group(1).strip()
    else:
        for a in soup.find_all("a"):
            if a.get_text(strip=True).lower().endswith("county"):
                county = a.get_text(strip=True); break

    return dict(department=department, phone=phone, website=website, county=county)

def fetch_detail_row(state_abbr: str, state_name: str, item: dict, delay_sec: float = 0.4):
    """
    개별 상세 페이지 fetch → dict row
    """
    html = http_get(item["url"], retries=3, pause=0.6)
    if not html:
        time.sleep(delay_sec)
        return None
    parsed = parse_department_page(html)
    time.sleep(delay_sec)  # 서버 배려
    return {
        "department_name": parsed.get("department",""),
        "phone": parsed.get("phone",""),
        "city": item.get("city",""),
        "state": state_name,
    }

# ---------- Gradio callbacks ----------

def load_list(state_label: str, kind_label: str):
    """
    주/종류 선택 시: 상세는 긁지 않고 '리스트(후보)'만 즉시 반환.
    """
    if not state_label:
        return pd.DataFrame(), [], "Pick a state"
    abbr = state_label.split(" — ")[0].upper()
    kind = "police" if kind_label.lower().startswith("police") else "sheriffs"
    cache_key = (abbr, kind)

    if cache_key in LIST_CACHE:
        candidates = LIST_CACHE[cache_key]
    else:
        list_url = f"{ROOT}/{abbr.lower()}/{'pollist.html' if kind=='police' else 'shrflist.html'}"
        html = http_get(list_url, retries=3, pause=0.5)
        candidates = extract_list_candidates(html, kind, abbr)
        LIST_CACHE[cache_key] = candidates

    # 표(리스트 미리보기): City / Kind / URL
    df_list = pd.DataFrame(
        [{"city_or_town": c["city"], "dept_type": c["kind"], "source_url": c["url"]} for c in candidates]
    )
    # 선택용 체크박스: "City — Kind" 라벨 → URL value
    options = [f'{c["city"] or "(County)"} — {c["kind"]} — {c["url"]}' for c in candidates]
    msg = f"Loaded {len(candidates)} items. Select some and fetch details."
    return df_list, gr.update(choices=options, value=[]), msg

def fetch_selected(state_label: str, selected_labels: list[str], max_workers: int, delay_ms: int):
    """
    선택된 라벨(문자열) → URL 파싱 → 병렬 fetch → DF + 파일
    """
    if not selected_labels:
        return pd.DataFrame(), None, None, "No selection"
    abbr = state_label.split(" — ")[0].upper()
    state_name = STATE_NAME_BY_ABBR.get(abbr, abbr)
    # parse selection → items
    items = []
    for s in selected_labels:
        # "{city} — {kind} — {url}"
        try:
            city, kind, url = s.split(" — ", 2)
        except ValueError:
            # 혹시 포맷 엇나가면 마지막 ' — ' 이후를 URL로 가정
            parts = s.rsplit(" — ", 1)
            city, kind, url = (parts[0], "", parts[1]) if len(parts) == 2 else ("", "", s)
        items.append({"city": city if city != "(County)" else "", "kind": kind, "url": url})

    delay_sec = max(0, delay_ms) / 1000.0
    max_workers_int = max(1, int(max_workers))
    rows = []
    with ThreadPoolExecutor(max_workers=max_workers_int) as ex:
        fut2item = {ex.submit(fetch_detail_row, abbr, state_name, it, delay_sec): it for it in items}
        for fut in as_completed(fut2item):
            row = fut.result()
            if row:
                rows.append(row)

    if not rows:
        return pd.DataFrame(), None, None, "No rows fetched (blocked or parse failed?)"

    df = pd.DataFrame(rows).sort_values(["city","department_name"], kind="stable").reset_index(drop=True)

    csv_bytes = df.to_csv(index=False).encode("utf-8-sig")
    csv_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".csv")
    try:
        csv_tmp.write(csv_bytes)
        csv_tmp.flush()
    finally:
        csv_tmp.close()

    xls_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx")
    try:
        with pd.ExcelWriter(xls_tmp.name, engine="openpyxl") as w:
            df.to_excel(w, sheet_name="USACOPS", index=False)
    finally:
        pass

    return df, csv_tmp.name, xls_tmp.name, f"Fetched {len(df)} rows."

def fetch_all_in_list(state_label: str, current_list_df: pd.DataFrame|None, max_workers: int, delay_ms: int):
    """
    현재 리스트 전체 병렬 상세 긁기
    """
    if current_list_df is None or current_list_df.empty:
        return pd.DataFrame(), None, None, "List empty"
    abbr = state_label.split(" — ")[0].upper()
    state_name = STATE_NAME_BY_ABBR.get(abbr, abbr)
    delay_sec = max(0, delay_ms) / 1000.0
    max_workers_int = max(1, int(max_workers))

    items = []
    for _, r in current_list_df.iterrows():
        items.append({"city": r.get("city_or_town","") or "", "kind": r.get("dept_type",""), "url": r.get("source_url","")})

    rows = []
    with ThreadPoolExecutor(max_workers=max_workers_int) as ex:
        fut2item = {ex.submit(fetch_detail_row, abbr, state_name, it, delay_sec): it for it in items}
        for fut in as_completed(fut2item):
            row = fut.result()
            if row:
                rows.append(row)

    if not rows:
        return pd.DataFrame(), None, None, "No rows fetched"
    df = pd.DataFrame(rows).sort_values(["city","department_name"], kind="stable").reset_index(drop=True)

    csv_bytes = df.to_csv(index=False).encode("utf-8-sig")
    csv_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".csv")
    try:
        csv_tmp.write(csv_bytes)
        csv_tmp.flush()
    finally:
        csv_tmp.close()

    xls_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx")
    try:
        with pd.ExcelWriter(xls_tmp.name, engine="openpyxl") as w:
            df.to_excel(w, sheet_name="USACOPS", index=False)
    finally:
        pass

    return df, csv_tmp.name, xls_tmp.name, f"Fetched {len(df)} rows."

# ===================== Gradio UI =====================
state_choices = [f"{abbr} — {STATE_NAME_BY_ABBR.get(abbr, abbr)}" for abbr in STATE_ORDER_BY_POP]

with gr.Blocks(title="USACOPS Interactive (Fast List + Parallel Details)") as demo:
    gr.Markdown("## USACOPS Interactive\n1) Pick a **State** & **Type** and click **Load List** (fast).\n2) Select some items, then **Fetch Selected** (parallel) — or **Fetch All in List**.")

    with gr.Row(max_height="360px"):
        state_dd = gr.Dropdown(state_choices, value=state_choices[0], label="State")
        kind_dd = gr.Radio(choices=["Police Departments", "Sheriffs"], value="Police Departments", label="Type")
    with gr.Row(max_height="360px"):
        load_btn = gr.Button("Load List", variant="primary")
        max_workers = gr.Slider(1, 32, value=8, step=1, label="Max workers (parallel detail fetch)")
        delay_ms = gr.Slider(0, 1500, value=400, step=50, label="Delay per request (ms)")

    status = gr.Markdown("")

    gr.Markdown("### List (preview: city/kind/url)\n_This is just the index; details are fetched on demand._")
    list_df = gr.Dataframe(
        headers=["city_or_town","dept_type","source_url"], 
        interactive=False,
        column_widths=[120, 100, None]  # 짧게: city_or_town=120px, dept_type=100px, source_url=나머지
    )

    # 선택 드롭다운 (다중 선택 가능)
    selected_box = gr.Dropdown(
        label="Select departments (from list above)", 
        multiselect=True, 
        interactive=True
    )

    with gr.Row(max_height="360px"):
        fetch_sel_btn = gr.Button("Fetch Selected")
        fetch_all_btn = gr.Button("Fetch All in List")

    out_df = gr.Dataframe(
        headers=["department_name","phone","city","state"],
        interactive=False, wrap=True
    )
    with gr.Row(max_height="420px"):
        dl_csv = gr.File(label="Download CSV", interactive=False)
        dl_xls = gr.File(label="Download Excel", interactive=False)

    # wire events
    load_btn.click(load_list, inputs=[state_dd, kind_dd], outputs=[list_df, selected_box, status])
    fetch_sel_btn.click(fetch_selected, inputs=[state_dd, selected_box, max_workers, delay_ms], outputs=[out_df, dl_csv, dl_xls, status])
    fetch_all_btn.click(fetch_all_in_list, inputs=[state_dd, list_df, max_workers, delay_ms], outputs=[out_df, dl_csv, dl_xls, status])

if __name__ == "__main__":
    demo.launch(share=True)