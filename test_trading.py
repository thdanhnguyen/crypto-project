from fastapi.testclient import TestClient
from main import app, get_db
from database import engine, Base
import models
import os

# Create tables
Base.metadata.create_all(bind=engine)

client = TestClient(app)

def run_tests():
    print("--- STARTING TESTS ---")

    # 1. Create Sellers and Buyers
    print("\n[1] Creating Users...")
    seller_res = client.post("/users/", json={"name": "Alice - Seller"})
    seller_id = seller_res.json()["id"]
    
    buyer_res = client.post("/users/", json={"name": "Bob - Buyer"})
    buyer_id = buyer_res.json()["id"]
    
    print(f"Seller ID: {seller_id}, Buyer ID: {buyer_id}")

    # 2. Deposit Funds
    print("\n[2] Depositing assets...")
    client.post(f"/users/{seller_id}/deposit", json={"token_amount": 0, "energy_amount": 100})
    client.post(f"/users/{buyer_id}/deposit", json={"token_amount": 500, "energy_amount": 0})
    
    s_bal = client.get(f"/users/{seller_id}").json()
    b_bal = client.get(f"/users/{buyer_id}").json()
    print(f"Seller Balances: Tokens={s_bal['token_balance']}, Energy={s_bal['energy_balance']}")
    print(f"Buyer Balances: Tokens={b_bal['token_balance']}, Energy={b_bal['energy_balance']}")

    # 3. Place Sell Order
    print("\n[3] Alice places a sell order for 10 energy at $5/energy...")
    s_order = client.post(f"/orders/?user_id={seller_id}", json={
        "type": "sell",
        "amount": 10,
        "price": 5
    })
    print("Sell Order:", s_order.json())

    # Check seller energy locked
    s_bal_locked = client.get(f"/users/{seller_id}").json()
    print(f"Seller Energy Balance after placing order (should be 90): {s_bal_locked['energy_balance']}")

    # 4. Place Buy Order
    print("\n[4] Bob places a buy order for 5 energy at $6/energy...")
    b_order = client.post(f"/orders/?user_id={buyer_id}", json={
        "type": "buy",
        "amount": 5,
        "price": 6
    })
    print("Buy Order Response:", b_order.json())

    # 5. Check Transaction and Balances after match
    print("\n[5] Checking Transactions and Balances after matching...")
    txs = client.get("/transactions/").json()
    print("Transactions:")
    for tx in txs:
        print(f"  Transfer: {tx['amount']} energy from {tx['seller_id']} to {tx['buyer_id']} @ ${tx['price']}")

    s_final = client.get(f"/users/{seller_id}").json()
    b_final = client.get(f"/users/{buyer_id}").json()
    
    # Expected stats:
    # Seller placed sell 10@5. Buyer placed buy 5@6.
    # Match 5 units at price 5 (seller's price).
    # Seller should get 5 * 5 = 25 tokens. Seller energy remains 90 (10 locked, 5 sold, 5 still open).
    # Buyer should spend 5 * 5 = 25 tokens (they locked 5*6=30, got 5 refund). Tokens: 500 - 25 = 475.
    # Buyer gets +5 energy.
    print("\nFinal Balances:")
    print(f"Seller -> Tokens: {s_final['token_balance']} (Expected: 25.0), Energy: {s_final['energy_balance']} (Expected: 90.0)")
    print(f"Buyer  -> Tokens: {b_final['token_balance']} (Expected: 475.0), Energy: {b_final['energy_balance']} (Expected: 5.0)")
    print("Reputation:")
    print(f"Seller -> {s_final['reputation_score']}")
    print(f"Buyer  -> {b_final['reputation_score']}")

    orders = client.get("/orders/").json()
    print("\nActive/All Orders:")
    for o in orders:
        print(o)

    print("\n--- TESTS COMPLETED ---")


if __name__ == "__main__":
    run_tests()
