from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import asyncio
import time
import random
from passlib.context import CryptContext

import models
import schemas
from database import engine, get_db, SessionLocal
from core import process_order, execute_direct_transfer
import hashlib
from auth import create_access_token, create_refresh_token, get_current_user
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Create DB tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="P2P Energy Trading Crypto Enhanced")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Websocket manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                pass

manager = ConnectionManager()

async def notify_clients():
    await manager.broadcast("update")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/")
def read_root():
    return {"message": "Welcome to Crypto Enhanced P2P Energy Trading"}

# --- USER ENDPOINTS ---

@app.post("/register", response_model=schemas.AuthResponse)
def register_user(user: schemas.UserRegister, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.name == user.name).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed_password = pwd_context.hash(user.password)
    # Generate a unique wallet address
    wallet_addr = "0x" + hashlib.sha256(f"{user.name}{time.time()}".encode()).hexdigest()[:10]
    db_user = models.User(name=user.name, password=hashed_password, wallet_address=wallet_addr)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    access_token = create_access_token(data={"sub": str(db_user.id)})
    refresh_token = create_refresh_token(data={"sub": str(db_user.id)})
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer", "user": db_user}

@app.post("/login", response_model=schemas.AuthResponse)
def login_user(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.name == user.name).first()
    if not db_user:
        raise HTTPException(status_code=400, detail="Invalid username or password")
    
    try:
        is_valid = pwd_context.verify(user.password, db_user.password)
    except Exception:
        # Fallback for old accounts with plain text passwords
        is_valid = (user.password == db_user.password)
        
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid username or password")
        
    access_token = create_access_token(data={"sub": str(db_user.id)})
    refresh_token = create_refresh_token(data={"sub": str(db_user.id)})
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer", "user": db_user}

@app.post("/web3_login", response_model=schemas.AuthResponse)
def web3_login(login_data: schemas.Web3Login, db: Session = Depends(get_db)):
    wallet_address = login_data.wallet_address.lower()
    # Tìm kiếm không phân biệt hoa thường với startswith hoặc exact match
    db_user = db.query(models.User).filter(models.User.wallet_address.ilike(wallet_address)).first()
    
    if not db_user:
        # Tự động đăng ký nếu chưa có
        random_name = f"Node_{wallet_address[-4:]}"
        # Mật khẩu rỗng hoặc dummy vì đăng nhập bằng Web3
        hashed_password = pwd_context.hash("web3_auth")
        db_user = models.User(name=random_name, password=hashed_password, wallet_address=wallet_address)
        
        # Tặng số dư khởi tạo cho ví Web3 (giống như handleAuth cũ)
        db_user.token_balance = 5000.0
        db_user.energy_balance = 2000.0
        
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        
    access_token = create_access_token(data={"sub": str(db_user.id)})
    refresh_token = create_refresh_token(data={"sub": str(db_user.id)})
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer", "user": db_user}

@app.post("/refresh", response_model=schemas.AuthResponse)
def refresh_token(refresh_data: schemas.Token, db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    from auth import SECRET_KEY, ALGORITHM
    from jose import JWTError, jwt
    try:
        payload = jwt.decode(refresh_data.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise credentials_exception
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    db_user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if db_user is None:
        raise credentials_exception
        
    access_token = create_access_token(data={"sub": str(db_user.id)})
    refresh_token = create_refresh_token(data={"sub": str(db_user.id)})
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer", "user": db_user}

@app.get("/users/{user_id}", response_model=schemas.UserResponse)
def read_user(user_id: int, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not db_user.wallet_address:
        db_user.wallet_address = "0x" + hashlib.sha256(f"{db_user.name}{time.time()}".encode()).hexdigest()[:10]
        db.commit()
        db.refresh(db_user)
        
    return db_user

@app.post("/users/{user_id}/deposit", response_model=schemas.UserResponse)
def deposit_funds(user_id: int, deposit: schemas.UserDeposit, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to deposit for this user")
        
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    db_user.token_balance += deposit.token_amount
    db_user.energy_balance += deposit.energy_amount
    db.commit()
    db.refresh(db_user)
    
    # trigger UI update
    background_tasks.add_task(notify_clients)
    return db_user

@app.post("/transfer", response_model=schemas.TransactionResponse)
def transfer_funds(transfer: schemas.DirectTransferCreate, user_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to transfer for this user")
    seller = db.query(models.User).filter(models.User.id == user_id).first()
    buyer = db.query(models.User).filter(models.User.wallet_address == transfer.to_wallet_address).first()
    
    if not seller:
        raise HTTPException(status_code=404, detail="Sender not found")
    if not buyer:
        raise HTTPException(status_code=404, detail="Recipient wallet address not found")
    if buyer.id == seller.id:
        raise HTTPException(status_code=400, detail="Cannot transfer to yourself")

    try:
        trx = execute_direct_transfer(db, buyer, seller, transfer.amount, transfer.price)
        background_tasks.add_task(notify_clients)
        return trx
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- ORDER ENDPOINTS ---

@app.post("/orders/", response_model=schemas.OrderResponse)
def place_order(order: schemas.OrderCreate, user_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to place order for this user")
    if order.type not in ["buy", "sell"]:
        raise HTTPException(status_code=400, detail="Order type must be 'buy' or 'sell'")
    if order.amount <= 0 or order.price <= 0:
         raise HTTPException(status_code=400, detail="Amount and price must be greater than 0")

    db_order = models.Order(
        type=order.type,
        user_id=user_id,
        amount=order.amount,
        price=order.price,
        status="open"
    )
    
    try:
        process_order(db, db_order)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    background_tasks.add_task(notify_clients)
    return db_order

@app.delete("/orders/{order_id}")
def cancel_order(order_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order or order.status != "open":
        raise HTTPException(status_code=400, detail="Order not found or not open")
        
    if order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this order")

    user = db.query(models.User).filter(models.User.id == order.user_id).first()
    if order.type == "buy":
        user.token_balance += (order.amount * order.price)
    elif order.type == "sell":
        user.energy_balance += order.amount

    order.status = "cancelled"
    db.commit()
    
    background_tasks.add_task(notify_clients)
    return {"message": "Order cancelled and escrow returned"}

@app.get("/orders/", response_model=List[schemas.OrderResponse])
def get_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    orders = db.query(models.Order).order_by(models.Order.timestamp.desc()).offset(skip).limit(limit).all()
    return orders


# --- TRANSACTION ENDPOINTS ---

@app.get("/transactions/", response_model=List[schemas.TransactionResponse])
def get_transactions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    transactions = db.query(models.Transaction).order_by(models.Transaction.timestamp.desc()).offset(skip).limit(limit).all()
    return transactions

@app.get("/blocks/")
def get_blocks(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    blocks = db.query(models.Block).order_by(models.Block.id.desc()).offset(skip).limit(limit).all()
    return blocks

@app.get("/market/stats", response_model=schemas.MarketStatsResponse)
def get_market_stats(db: Session = Depends(get_db)):
    recent_txs = db.query(models.Transaction).order_by(models.Transaction.id.desc()).limit(10).all()
    if not recent_txs:
        return {"current_price": 0.0, "total_volume": 0.0, "recommended_buy": 0.0, "recommended_sell": 0.0}
    
    avg_price = sum(tx.price for tx in recent_txs) / len(recent_txs)
    total_vol = sum(tx.amount for tx in recent_txs)
    
    return {
        "current_price": round(avg_price, 2),
        "total_volume": round(total_vol, 2),
        "recommended_buy": round(avg_price * 0.98, 2),
        "recommended_sell": round(avg_price * 1.02, 2)
    }

async def market_maker_bot():
    while True:
        await asyncio.sleep(12)
        try:
            db = SessionLocal()
            ai_user = db.query(models.User).filter(models.User.name == "Grid_AI").first()
            if not ai_user:
                hashed = pwd_context.hash("bot_password")
                ai_user = models.User(name="Grid_AI", password=hashed, token_balance=10000000, energy_balance=100000)
                db.add(ai_user)
                db.commit()
                db.refresh(ai_user)

            current_price = 2.0
            last_tx = db.query(models.Transaction).order_by(models.Transaction.id.desc()).first()
            if last_tx:
                current_price = last_tx.price
            
            order_type = random.choice(["buy", "sell"])
            amount = round(random.uniform(5.0, 50.0), 1)
            price = round(current_price * random.uniform(0.95, 1.05), 2)
            
            db_order = models.Order(
                type=order_type,
                user_id=ai_user.id,
                amount=amount,
                price=price,
                status="open"
            )
            process_order(db, db_order)
            db.close()
            await notify_clients()
        except Exception:
            pass

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(market_maker_bot())

