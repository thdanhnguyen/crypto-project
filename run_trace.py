import subprocess
import time
import requests

print("Starting Uvicorn...")
server = subprocess.Popen(["python", "-u", "-m", "uvicorn", "main:app"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
time.sleep(3) # wait for startup

URL = "http://127.0.0.1:8000"

def create_user(name, password):
    res = requests.post(f"{URL}/login", json={"name": name, "password": password})
    if res.status_code == 404 or res.status_code == 400:
        res = requests.post(f"{URL}/register", json={"name": name, "password": password})
    data = res.json()
    return data.get("access_token"), data.get("user", {}).get("id")

print("Running test...")
try:
    t1, u1 = create_user("buyerA", "1")
    t2, u2 = create_user("sellerB", "1")
    print("Placing buyerA buy...")
    res = requests.post(f"{URL}/orders/?user_id={u1}", json={"type": "buy", "amount": 10, "price": 5}, headers={"Authorization": f"Bearer {t1}"}, timeout=8)
    print("buyerA result:", res.status_code)
    print("Placing sellerB sell...")
    res2 = requests.post(f"{URL}/orders/?user_id={u2}", json={"type": "sell", "amount": 10, "price": 5}, headers={"Authorization": f"Bearer {t2}"}, timeout=8)
    print("sellerB result:", res2.status_code)
except Exception as e:
    print("Exception during test:", e)

print("Killing server...")
server.terminate()
stdout, _ = server.communicate()
with open("uvicorn_trace.log", "w", encoding="utf-8") as f:
    f.write(stdout)
