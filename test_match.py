import requests
import json
import threading
import time

URL = "http://127.0.0.1:8000"

def create_user(name, password):
    res = requests.post(f"{URL}/login", json={"name": name, "password": password})
    if res.status_code == 404 or res.status_code == 400:
        res = requests.post(f"{URL}/register", json={"name": name, "password": password})
    print(f"Auth {name}:", res.status_code)
    data = res.json()
    return data.get("access_token"), data.get("user", {}).get("id")

def place_order(name, token, uid, order_type, amount, price):
    print(f"{name} placing {order_type}...")
    headers = {"Authorization": f"Bearer {token}"}
    res = requests.post(f"{URL}/orders/?user_id={uid}", json={"type": order_type, "amount": amount, "price": price}, headers=headers)
    print(f"{name} result:", res.status_code, res.text)

def test():
    t1, u1 = create_user("buyer1", "123")
    t2, u2 = create_user("seller1", "123")
    
    # Place buy order
    place_order("buyer1", t1, u1, "buy", 10, 5)
    
    # Place matching sell order
    place_order("seller1", t2, u2, "sell", 10, 5)

if __name__ == "__main__":
    test()
