from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# User Schemas
class UserRegister(BaseModel):
    name: str
    password: str

class UserLogin(BaseModel):
    name: str
    password: str

class Web3Login(BaseModel):
    wallet_address: str
    signature: Optional[str] = None

class UserDeposit(BaseModel):
    token_amount: float = 0.0
    energy_amount: float = 0.0

class UserResponse(BaseModel):
    id: int
    name: str
    token_balance: float
    energy_balance: float
    reputation_score: float
    wallet_address: str

    class Config:
        from_attributes = True

class DirectTransferCreate(BaseModel):
    to_wallet_address: str
    amount: float
    price: float

# Order Schemas
class OrderCreate(BaseModel):
    type: str # "buy" or "sell"
    amount: float
    price: float

class OrderResponse(BaseModel):
    id: int
    type: str
    user_id: int
    amount: float
    initial_amount: Optional[float] = None
    price: float
    status: str
    timestamp: datetime

    class Config:
        from_attributes = True

# Transaction & Block Schemas
class TransactionResponse(BaseModel):
    id: int
    tx_hash: Optional[str] = None
    block_id: Optional[int] = None
    buyer_id: int
    seller_id: int
    amount: float
    price: float
    gas_fee: float
    timestamp: datetime

    class Config:
        from_attributes = True

class MarketStatsResponse(BaseModel):
    current_price: float
    total_volume: float
    recommended_buy: float
    recommended_sell: float

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class TokenData(BaseModel):
    name: Optional[str] = None
    wallet_address: Optional[str] = None
    user_id: Optional[int] = None

class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: UserResponse
