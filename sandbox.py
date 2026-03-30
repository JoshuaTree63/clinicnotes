import time
import json
import pandas as pd
from datetime import datetime, timedelta

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

# -----------------------------
# CONFIG
# -----------------------------
URL = "https://www.nadlan.gov.il/?view=settlement&id=6200&page=deals"

OUTPUT_EXCEL = "bat_yam_real_estate.xlsx"

# -----------------------------
# DATE RANGE
# -----------------------------
today = datetime.today()
five_years_ago = today - timedelta(days=5 * 365)

# -----------------------------
# SETUP DRIVER
# -----------------------------
options = Options()
options.add_argument("--headless")  # remove if you want to see browser
options.add_argument("--disable-blink-features=AutomationControlled")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")

driver = webdriver.Chrome(
    service=Service(ChromeDriverManager().install()),
    options=options
)

# -----------------------------
# ENABLE NETWORK LOGGING
# -----------------------------
driver.execute_cdp_cmd("Network.enable", {})

print("Opening site...")
driver.get(URL)

time.sleep(5)  # let page fully load

# -----------------------------
# APPLY DATE FILTER (UI)
# -----------------------------
print("Applying date filter...")

try:
    # Click filter button if needed (may change!)
    driver.find_element(By.CSS_SELECTOR, "button").click()
except:
    pass

# NOTE:
# Nadlan UI is dynamic — selectors may change.
# If needed, we refine this step after first run.

time.sleep(3)

# -----------------------------
# SCROLL TO LOAD ALL DATA
# -----------------------------
print("Scrolling to load all deals...")

last_height = driver.execute_script("return document.body.scrollHeight")

while True:
    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
    time.sleep(2)

    new_height = driver.execute_script("return document.body.scrollHeight")
    if new_height == last_height:
        break
    last_height = new_height

print("Finished scrolling")

# -----------------------------
# CAPTURE NETWORK RESPONSES
# -----------------------------
logs = driver.get_log("performance")

deals_data = []

for log in logs:
    message = json.loads(log["message"])["message"]

    if message["method"] == "Network.responseReceived":
        url = message["params"]["response"]["url"]

        if "GetAssestAndDeals" in url:
            request_id = message["params"]["requestId"]

            try:
                response = driver.execute_cdp_cmd(
                    "Network.getResponseBody",
                    {"requestId": request_id}
                )

                data = json.loads(response["body"])

                results = data.get("AllResults", {})
                deals = results.get("Deals", [])

                deals_data.extend(deals)

            except:
                pass

driver.quit()

# -----------------------------
# DATAFRAME
# -----------------------------
df = pd.DataFrame(deals_data)

print(f"\nTotal deals fetched: {len(df)}")

if df.empty:
    print("❌ No data captured — selectors may need adjustment")
    exit()

# -----------------------------
# FILTER LAST 5 YEARS (SAFE)
# -----------------------------
if "DEALDATETIME" in df.columns:
    df["DEALDATETIME"] = pd.to_datetime(df["DEALDATETIME"], errors="coerce")
    df = df[df["DEALDATETIME"] >= five_years_ago]

# -----------------------------
# SAVE
# -----------------------------
df.to_excel(OUTPUT_EXCEL, index=False)

print(f"✅ Saved to {OUTPUT_EXCEL}")