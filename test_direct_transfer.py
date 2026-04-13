from fastapi.testclient import TestClient
from main import app
import models
from database import SessionLocal

client = TestClient(app)

def test_direct_transfer():
    print("--- TESTING DIRECT TRANSFER ---")
    
    # 1. Create two users
    u1_res = client.post("/register", json={"name": "UserA", "password": "password123"})
    user_a = u1_res.json()
    u2_res = client.post("/register", json={"name": "UserB", "password": "password456"})
    user_b = u2_res.json()
    
    print(f"Created UserA (Wallet: {user_a['wallet_address']}) and UserB (Wallet: {user_b['wallet_address']})")
    
    # 2. Deposit assets
    client.post(f"/users/{user_a['id']}/deposit", json={"token_amount": 1000, "energy_amount": 0})
    client.post(f"/users/{user_b['id']}/deposit", json={"token_amount": 0, "energy_amount": 500})
    
    # 3. UserA buys 100 kWh from UserB at price 2.0
    print("UserA buying 100 kWh from UserB...")
    transfer_res = client.post(f"/transfer?user_id={user_a['id']}", json={
        "to_wallet_address": user_b['wallet_address'],
        "amount": 100,
        "price": 2.0
    })
    
    if transfer_res.status_code == 200:
        print("Transfer Success!")
        tx = transfer_res.json()
        print(f"Transaction Hash: {tx['tx_hash']}")
        
        # 4. Check balances
        a_final = client.get(f"/users/{user_a['id']}").json()
        b_final = client.get(f"/users/{user_b['id']}").json()
        
        print(f"UserA Final Balances: Tokens={a_final['token_balance']}, Energy={a_final['energy_balance']}")
        print(f"UserB Final Balances: Tokens={b_final['token_balance']}, Energy={b_final['energy_balance']}")
        
        # Expected A: 1000 - 200 = 800 tokens, 100 energy
        # Expected B: 500 - 100 = 400 energy, 199 tokens (200 - 1 token gas fee at 0.5%)
        assert a_final['token_balance'] == 800.0
        assert a_final['energy_balance'] == 100.0
        assert b_final['energy_balance'] == 400.0
        assert b_final['token_balance'] == 199.0
        print("Assertions passed!")
    else:
        print(f"Transfer Failed: {transfer_res.json()}")

if __name__ == "__main__":
    test_direct_transfer()
