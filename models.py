from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
import datetime
from database import Base
from sqlalchemy.orm import relationship

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, unique=True)
    password = Column(String)
    token_balance = Column(Float, default=0.0)
    energy_balance = Column(Float, default=0.0)
    reputation_score = Column(Float, default=100.0)
    wallet_address = Column(String, unique=True, index=True)

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, index=True) # "buy" or "sell"
    user_id = Column(Integer, index=True)
    amount = Column(Float) # Remaining amount
    initial_amount = Column(Float) # For history
    price = Column(Float)
    status = Column(String, default="open") # "open", "completed", "cancelled"
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class Block(Base):
    __tablename__ = "blocks"

    id = Column(Integer, primary_key=True, index=True)
    block_hash = Column(String, index=True, unique=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    tx_hash = Column(String, index=True, unique=True)
    block_id = Column(Integer, ForeignKey("blocks.id"))
    buyer_id = Column(Integer)
    seller_id = Column(Integer)
    amount = Column(Float)
    price = Column(Float)
    gas_fee = Column(Float, default=0.0)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
