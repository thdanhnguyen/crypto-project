import requests
import json

URL = "http://127.0.0.1:8000"

def test():
    # Login
    print("Logging in...")
    res = requests.post(f"{URL}/login", json={"name": "test_user_script", "password": "123"})
    if res.status_code == 404 or res.status_code == 400:
        # Register instead
        res = requests.post(f"{URL}/register", json={"name": "test_user_script", "password": "123"})
    print("Auth status:", res.status_code)
    data = res.json()
    token = data.get("access_token")
    user_id = data.get("user", {}).get("id")
    
    if not token:
        print("No token")
        return

    # Post order
    print("Posting order...")
    order_data = {"type": "buy", "amount": 10, "price": 5}
    headers = {"Authorization": f"Bearer {token}"}
    res_order = requests.post(f"{URL}/orders/?user_id={user_id}", json=order_data, headers=headers)
    print("Order status:", res_order.status_code)
    print("Order response:", res_order.text)

if __name__ == "__main__":
    test()
