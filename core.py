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
    
    # Giả lập hao hụt truyền tải lưới điện (Transmission Loss)
    LOSS_FACTOR = 0.02 # 2% hao hụt
    actual_received_energy = amount * (1 - LOSS_FACTOR)

    buyer.energy_balance += actual_received_energy
    seller.token_balance += (total_cost - gas_fee) # Deduct from seller for simplicity
    
    price_difference = buy_order.price - price
    if price_difference > 0:
        buyer.token_balance += (amount * price_difference)

    buyer.reputation_score += 1.0
    seller.reputation_score += 1.0

    last_block = db.query(Block).order_by(Block.id.desc()).first()
    
    # Cơ chế sinh Block dựa trên thời gian thực tế (Block Time = 10s) thay vì đếm số giao dịch
    BLOCK_TIME = 10 
    should_create_new_block = False
    
    if not last_block:
        should_create_new_block = True
    else:
        time_since_last_block = (datetime.datetime.utcnow() - last_block.timestamp).total_seconds()
        if time_since_last_block >= BLOCK_TIME:
            should_create_new_block = True

    if should_create_new_block:
        b_hash = hashlib.sha256(str(time.time()).encode()).hexdigest()
        new_block = Block(block_hash=b_hash)
        db.add(new_block)
        db.flush()
        db.refresh(new_block)
        active_block_id = new_block.id
    else:
        active_block_id = last_block.id

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
    gas_fee = total_cost * 0.005 

    if buyer.token_balance < total_cost:
        raise ValueError("Insufficient tokens")
    if seller.energy_balance < amount:
        raise ValueError("Insufficient energy")

    # Giả lập hao hụt truyền tải lưới điện (Transmission Loss)
    LOSS_FACTOR = 0.02 # 2% hao hụt
    actual_received_energy = amount * (1 - LOSS_FACTOR)

    buyer.token_balance -= total_cost
    buyer.energy_balance += actual_received_energy
    seller.energy_balance -= amount
    seller.token_balance += (total_cost - gas_fee)

    buyer.reputation_score += 0.5 # Direct trade gets less reputation than market match
    seller.reputation_score += 0.5

    last_block = db.query(Block).order_by(Block.id.desc()).first()
    
    # Cơ chế sinh Block dựa trên thời gian (Block Time = 10s) thay vì đếm giao dịch
    BLOCK_TIME = 10 
    should_create_new_block = False
    
    if not last_block:
        should_create_new_block = True
    else:
        time_since_last_block = (datetime.datetime.utcnow() - last_block.timestamp).total_seconds()
        if time_since_last_block >= BLOCK_TIME:
            should_create_new_block = True

    if should_create_new_block:
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
