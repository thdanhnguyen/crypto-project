import requests
URL = "http://127.0.0.1:8000"

def create_user(name, password):
    res = requests.post(f"{URL}/login", json={"name": name, "password": password})
    if res.status_code == 404 or res.status_code == 400:
        res = requests.post(f"{URL}/register", json={"name": name, "password": password})
    data = res.json()
    return data.get("access_token"), data.get("user", {}).get("id")

def p(name, token, uid, order_type, amount, price):
    print(f"--- Placing {order_type} ---")
    headers = {"Authorization": f"Bearer {token}"}
    res = requests.post(f"{URL}/orders/?user_id={uid}", json={"type": order_type, "amount": amount, "price": price}, headers=headers, timeout=10)
    print(f"Result: {res.status_code}")

def test():
    t1, u1 = create_user("buyerX", "1")
    t2, u2 = create_user("sellerY", "1")
    p("buyerX", t1, u1, "buy", 10, 5)
    print("Now placing exact match:")
    p("sellerY", t2, u2, "sell", 10, 5)

if __name__ == "__main__":
    test()
