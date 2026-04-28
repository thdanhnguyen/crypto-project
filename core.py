import hashlib
import time
from sqlalchemy.orm import Session
from models import User, Order, Transaction, Block
import datetime

def process_order(db: Session, new_order: Order):
    user = db.query(User).filter(User.id == new_order.user_id).first()
    if not user:
        raise ValueError("User not found")

    new_order.initial_amount = new_order.amount

    if new_order.type == "buy":
        total_cost = new_order.amount * new_order.price
        if user.token_balance < total_cost:
            raise ValueError("Insufficient tokens")
        user.token_balance -= total_cost
        db.flush()
    elif new_order.type == "sell":
        if user.energy_balance < new_order.amount:
            raise ValueError("Insufficient energy")
        user.energy_balance -= new_order.amount
        db.flush()

    db.add(new_order)
    db.flush()
    db.refresh(new_order)

    match_orders(db)
    db.commit()

def match_orders(db: Session):
    buy_orders = db.query(Order).filter(Order.type == "buy", Order.status == "open").order_by(Order.price.desc(), Order.timestamp.asc()).all()
    sell_orders = db.query(Order).filter(Order.type == "sell", Order.status == "open").order_by(Order.price.asc(), Order.timestamp.asc()).all()

    for buy_order in buy_orders:
        if buy_order.amount <= 0:
            continue
            
        for sell_order in sell_orders:
            if sell_order.amount <= 0 or sell_order.status != "open":
                continue
                
            if buy_order.price >= sell_order.price:
                trade_amount = min(buy_order.amount, sell_order.amount)
                execution_price = sell_order.price
                
                execute_trade(db, buy_order, sell_order, trade_amount, execution_price)

                buy_order.amount -= trade_amount
                sell_order.amount -= trade_amount
                
                if buy_order.amount == 0:
                    buy_order.status = "completed"
                if sell_order.amount == 0:
                    sell_order.status = "completed"
                    
                db.flush()
                if buy_order.status == "completed":
                    break

def execute_trade(db: Session, buy_order: Order, sell_order: Order, amount: float, price: float):
    buyer = db.query(User).filter(User.id == buy_order.user_id).first()
    seller = db.query(User).filter(User.id == sell_order.user_id).first()

    total_cost = amount * price
    gas_fee = total_cost * 0.01 # 1% Gas Fee

    buyer.energy_balance += amount
    seller.token_balance += (total_cost - gas_fee) # Deduct from seller for simplicity
    
    price_difference = buy_order.price - price
    if price_difference > 0:
        buyer.token_balance += (amount * price_difference)

    buyer.reputation_score += 1.0
    seller.reputation_score += 1.0

    # Block generation
    last_block = db.query(Block).order_by(Block.id.desc()).first()
    # Simple rule: a block holds max 3 txs, or just create continuously for demo if none exists.
    # To keep it simple, let's create a new block if none or randomly (just 1 block per trade for demo)
    # Actually, let's reuse last_block if it exists and has less than 5 txs
    tx_count_in_block = 0
    if last_block:
        tx_count_in_block = db.query(Transaction).filter(Transaction.block_id == last_block.id).count()

    if not last_block or tx_count_in_block >= 5:
        b_hash = hashlib.sha256(str(time.time()).encode()).hexdigest()
        new_block = Block(block_hash=b_hash)
        db.add(new_block)
        db.flush()
        db.refresh(new_block)
        active_block_id = new_block.id
    else:
        active_block_id = last_block.id

    # Generate tx_hash
    tx_str = f"{buyer.id}-{seller.id}-{amount}-{price}-{time.time()}"
    tx_hash = "0x" + hashlib.sha256(tx_str.encode()).hexdigest()

    trx = Transaction(
        tx_hash=tx_hash,
        block_id=active_block_id,
        buyer_id=buyer.id,
        seller_id=seller.id,
        amount=amount,
        price=price,
        gas_fee=gas_fee
    )
    db.add(trx)
    db.flush()

def execute_direct_transfer(db: Session, buyer: User, seller: User, amount: float, price: float):
    total_cost = amount * price
    # Direct transfer has lower gas fee for demo (0.5%)
    gas_fee = total_cost * 0.005 

    if buyer.token_balance < total_cost:
        raise ValueError("Insufficient tokens")
    if seller.energy_balance < amount:
        raise ValueError("Insufficient energy")

    buyer.token_balance -= total_cost
    buyer.energy_balance += amount
    seller.energy_balance -= amount
    seller.token_balance += (total_cost - gas_fee)

    buyer.reputation_score += 0.5 # Direct trade gets less reputation than market match
    seller.reputation_score += 0.5

    # Block and Transaction generation (reuse logic)
    last_block = db.query(Block).order_by(Block.id.desc()).first()
    tx_count_in_block = 0
    if last_block:
        tx_count_in_block = db.query(Transaction).filter(Transaction.block_id == last_block.id).count()

    if not last_block or tx_count_in_block >= 5:
        b_hash = hashlib.sha256(str(time.time()).encode()).hexdigest()
        new_block = Block(block_hash=b_hash)
        db.add(new_block)
        db.commit()
        db.refresh(new_block)
        active_block_id = new_block.id
    else:
        active_block_id = last_block.id

    tx_str = f"direct-{buyer.id}-{seller.id}-{amount}-{price}-{time.time()}"
    tx_hash = "0x" + hashlib.sha256(tx_str.encode()).hexdigest()

    trx = Transaction(
        tx_hash=tx_hash,
        block_id=active_block_id,
        buyer_id=buyer.id,
        seller_id=seller.id,
        amount=amount,
        price=price,
        gas_fee=gas_fee
    )
    db.add(trx)
    db.commit()
    return trx
