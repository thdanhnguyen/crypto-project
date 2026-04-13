import React, { useState, useEffect, useRef } from 'react';
import { api } from './api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import toast, { Toaster } from 'react-hot-toast';
import { BrowserProvider, formatEther } from 'ethers';

function App() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({ current_price: 0, total_volume: 0, recommended_buy: 0, recommended_sell: 0 });
  const ws = useRef(null);

  // Auth Forms
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [view, setView] = useState('dashboard'); // 'dashboard' or 'home'
  const [web3Balance, setWeb3Balance] = useState("0");

  const [orderType, setOrderType] = useState('buy');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');

  // Direct P2P Form
  const [recipientWallet, setRecipientWallet] = useState('');
  const [directAmount, setDirectAmount] = useState('');
  const [directPrice, setDirectPrice] = useState('');

  const loadData = async (uid) => {
    try {
        if(uid) {
            const u = await api.getUser(uid);
            setUser(prev => (prev && prev.id === u.id) ? u : prev);
        }
        const o = await api.getOrders();
        setOrders(o);
        const t = await api.getTransactions();
        setTransactions(t);
        const s = await api.getMarketStats();
        setStats(s);
    } catch (e) {
        console.error(e);
    }
  };

  useEffect(() => {
    // Check if user is saved in localStorage
    const savedUserId = localStorage.getItem('eco_exchange_user_id');
    if (savedUserId && !user) {
        api.getUser(parseInt(savedUserId)).then(u => {
            setUser(u);
            toast.success(`Chào mừng trở lại, ${u.name}!`, { icon: "👋" });
        }).catch(() => {
            localStorage.removeItem('eco_exchange_user_id');
        });
    }

    if(user) {
        loadData(user.id);
        fetchWeb3Balance(user.wallet_address);
    }

    ws.current = new WebSocket('ws://127.0.0.1:8000/ws');
    ws.current.onmessage = (event) => {
        if (event.data === "update") {
            if(user) loadData(user.id);
        }
    };

    return () => {
        if(ws.current) ws.current.close();
    };
  }, [user]);

  const fetchWeb3Balance = async (address) => {
      try {
          if (window.ethereum) {
              const provider = new BrowserProvider(window.ethereum);
              const balance = await provider.getBalance(address);
              setWeb3Balance(formatEther(balance));
          }
      } catch (err) {
          console.error("Failed to fetch Web3 Balance:", err);
      }
  };

  const handleWeb3Login = async () => {
      if (!window.ethereum) {
          toast.error("Vui lòng cài đặt MetaMask để dùng chức năng này!");
          return;
      }
      try {
          const provider = new BrowserProvider(window.ethereum);
          await provider.send("eth_requestAccounts", []);
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          
          toast.loading("Đang xác thực ví qua mạng blockchain...", { id: "web3Auth" });
          const u = await api.web3Login(address, "dummy_signature");
          setUser(u);
          localStorage.setItem('eco_exchange_user_id', u.id);
          toast.success("Đăng nhập Định danh Web3 thành công!", { id: "web3Auth" });
          
          fetchWeb3Balance(address);
      } catch (err) {
          toast.dismiss("web3Auth");
          toast.error("Lỗi kết nối Web3: " + err.message);
      }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
        let u;
        if (isRegisterMode) {
            u = await api.registerUser(username, password);
            toast.success("Wallet Created & Registered successfully!", { icon: "🌱" });
            await api.depositFunds(u.id, 5000, 2000); 
            toast("Tặng 5000 USDT & 2000 kWh cho Tài Khoản Năng Lượng Mới", { icon: "🎁" });
        } else {
            u = await api.loginUser(username, password);
            toast.success("Đăng nhập Node thành công!");
        }
        setUser(u);
        localStorage.setItem('eco_exchange_user_id', u.id);
    } catch (err) {
        toast.error(err.message);
    }
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    const promise = api.placeOrder(user.id, orderType, parseFloat(amount), parseFloat(price)).then(() => {
        setAmount('');
        setPrice('');
        loadData(user.id);
    });
    toast.promise(promise, {
        loading: 'Broadcasting transaction...',
        success: 'Transaction confirmed!',
        error: (err) => err.message || 'Lỗi giao dịch'
    });
  };

  const handleCancelOrder = async (orderId) => {
    try {
        await api.cancelOrder(orderId);
        toast.success("Đã hủy lệnh. Escrow returned.", {icon: "♻️"});
        loadData(user.id);
    } catch (e) {
        toast.error(e.message);
    }
  };

  const handlePercent = (percent) => {
      if (orderType === 'buy') {
          const priceVal = parseFloat(price) || stats.current_price || 1;
          const affordable = user.token_balance / priceVal;
          setAmount((affordable * (percent / 100)).toFixed(1));
      } else {
          setAmount((user.energy_balance * (percent / 100)).toFixed(1));
      }
  };

  const handleDirectTransfer = async (e) => {
    e.preventDefault();
    const promise = api.transferFunds(user.id, recipientWallet, parseFloat(directAmount), parseFloat(directPrice)).then(() => {
        setRecipientWallet('');
        setDirectAmount('');
        setDirectPrice('');
        loadData(user.id);
    });
    toast.promise(promise, {
        loading: 'Processing direct P2P swap...',
        success: 'Transfer completed successfully!',
        error: (err) => err.message || 'Lỗi chuyển tiền'
    });
  };

  const chartData = [...transactions].reverse().map(t => ({
      time: new Date(t.timestamp + 'Z').toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute:'2-digit', second:'2-digit'}),
      price: t.price
  }));

  const getAggregatedOrders = (type) => {
      const filtered = orders.filter(o => o.type === type && o.status === 'open');
      const grouped = {};
      filtered.forEach(o => {
          if (!grouped[o.price]) grouped[o.price] = 0;
          grouped[o.price] += o.amount;
      });
      const result = Object.keys(grouped).map(p => ({ price: parseFloat(p), amount: grouped[p] }));
      return result.sort((a,b) => b.price - a.price);
  };
  const sellOrdersAgg = getAggregatedOrders('sell');
  const buyOrdersAgg = getAggregatedOrders('buy');

  // Login Screen
  if (!user) {
      return (
        <div className="auth-container">
            <Toaster position="top-center" toastOptions={{ style: {fontFamily: 'Outfit'} }}/>
            <div className="auth-wrapper">
                <div className="auth-hero">
                    <div className="icon-float" style={{top: '-50px', left: '-50px', fontSize: '20rem'}}>🌿</div>
                    <div className="icon-float" style={{bottom: '-20px', right: '-20px', fontSize: '15rem', opacity: 0.1, animationDelay:'1s'}}>☀️</div>
                    
                    <span className="sdg-pill" style={{marginBottom: 'auto'}}>SDG 7: Clean Energy</span>
                    
                    <div>
                        <h1>Empowering<br/>The Future of<br/><span style={{color: 'var(--accent)'}}>Green Energy.</span></h1>
                        <p>Nền tảng giao dịch năng lượng tải phân tán ngang hàng (P2P), hướng tới môi trường bền vững và lưới điện thông minh minh bạch.</p>
                    </div>
                </div>
                <div className="auth-form">
                    <div style={{marginBottom: '2rem'}}>
                        <h2 style={{fontSize: '2rem'}}>{isRegisterMode ? 'Tham Gia Lưới Điện' : 'Đăng Nhập Node'}</h2>
                        <p style={{color: '#64748b'}}>Sử dụng định danh phi tập trung (Web3)</p>
                    </div>

                    <button type="button" onClick={handleWeb3Login} style={{width: '100%', marginBottom: '1.5rem', height: '54px', background: 'linear-gradient(135deg, #f6851b, #f56c08)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'}}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" width="24" alt="MetaMask" style={{filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'}} />
                        Đăng Nhập bằng MetaMask (Đề xuất)
                    </button>
                    
                    <div style={{textAlign: 'center', marginBottom: '1rem', color: '#94a3b8', fontSize: '0.85rem'}}>HOẶC DÙNG TÀI KHOẢN TRUYỀN THỐNG</div>

                    <form onSubmit={handleAuth}>
                        <div>
                            <label className="input-label">Mã định danh (Username)</label>
                            <input type="text" placeholder="e.g. solarpilot" value={username} onChange={e=>setUsername(e.target.value)} required />
                        </div>
                        <div>
                            <label className="input-label">Mật khẩu truy cập</label>
                            <input type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} required />
                        </div>
                        <button type="submit" style={{width: '100%', marginTop: '1rem', height: '54px'}}>
                            {isRegisterMode ? 'Khởi tạo Ví Năng Lượng' : 'Bắt Đầu Giao Dịch'}
                        </button>
                    </form>
                    <div style={{textAlign: 'center', marginTop: '2rem'}}>
                        <span style={{cursor: 'pointer', color: 'var(--primary)', fontWeight: '600'}} onClick={() => setIsRegisterMode(!isRegisterMode)}>
                            {isRegisterMode ? 'Đã có Node? Kế nối ngay ➔' : 'Tạo Node phân tán mới ➔'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  // Dashboard Screen
  return (
    <div className="dashboard-container">
        <Toaster position="top-right" toastOptions={{ style: {fontFamily: 'Outfit', fontWeight: 500} }}/>
        
        {/* HEADER AREA */}
        <div className="card header-area">
            <div>
                <h2 className="text-gradient" style={{fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                    🌿 P2P Eco-Exchange
                </h2>
                <div style={{marginTop: '0.5rem', display: 'flex', gap: '0.5rem'}}>
                    <span className="badge badge-hash">👤 {user.name}</span>
                    <span className="badge badge-hash" title={user.wallet_address}>💳 {user.wallet_address?.substring(0, 10)}...</span>
                    <span className="badge" style={{background: 'var(--accent)', color: 'var(--text-dark)'}}>⭐️ OPR: {user.reputation_score}</span>
                </div>
            </div>
            <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
                <button onClick={() => setView('home')} className={view === 'home' ? "btn-nav active" : "btn-nav"}>Trang Chủ</button>
                <button onClick={() => setView('dashboard')} className={view === 'dashboard' ? "btn-nav active" : "btn-nav"}>Sàn Giao Dịch</button>
                <button onClick={() => setView('profile')} className={view === 'profile' ? "btn-nav active" : "btn-nav"}>Quản lý cá nhân</button>
            </div>
            <div style={{display: 'flex', gap: '1.5rem', alignItems: 'center'}}>
                <div className="stat-box">
                    <span className="stat-label">Tài sản Số (USDT)</span>
                    <span className="stat-value text-gradient">${user.token_balance.toFixed(2)}</span>
                </div>
                <div className="stat-box">
                    <span className="stat-label">Pin Dự Trữ Di Động</span>
                    <span className="stat-value">{user.energy_balance.toFixed(2)} <span style={{fontSize:'1rem'}}>kWh</span></span>
                </div>
            </div>
        </div>
        
        {view === 'profile' && (
            <div className="card profile-card" style={{animation: 'slideUp 0.5s ease', gridColumn: '1 / -1', maxWidth: '600px', margin: '2rem auto'}}>
                <h2 style={{fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                    👤 Thông Tin Cá Nhân
                </h2>
                
                <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
                    <div style={{background: 'rgba(0,0,0,0.02)', padding: '1.5rem', borderRadius: '12px'}}>
                        <p className="input-label">Tên hiển thị (Node)</p>
                        <h3 style={{fontSize: '1.2rem'}}>{user.name}</h3>
                    </div>
                    
                    <div style={{background: 'rgba(0,0,0,0.02)', padding: '1.5rem', borderRadius: '12px'}}>
                        <p className="input-label">Địa chỉ Ví Nhận Năng Lượng (Wallet)</p>
                        <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
                            <code style={{background: 'var(--white)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '1rem', border: '1px solid #e2e8f0', flex: 1}}>
                                {user.wallet_address}
                            </code>
                            <button className="btn-outline" onClick={() => {navigator.clipboard.writeText(user.wallet_address); toast.success('Đã copy!');}} style={{padding: '0.5rem 1rem'}}>Copy</button>
                        </div>
                        <p style={{fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem'}}>Sử dụng địa chỉ này để nhận năng lượng hoặc USDT qua chuyển khoản P2P trực tiếp.</p>
                    </div>

                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                        <div style={{background: 'rgba(0,200,83,0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(0,200,83,0.1)'}}>
                             <p className="input-label">Số dư USDT</p>
                             <h3 className="text-gradient" style={{fontSize: '1.5rem'}}>${user.token_balance.toFixed(2)}</h3>
                        </div>
                        <div style={{background: 'rgba(246,133,27,0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(246,133,27,0.1)'}}>
                             <p className="input-label" style={{display: 'flex', justifyContent: 'space-between'}}>
                                 <span>Số dư Testnet (ETH)</span>
                                 <span style={{cursor: 'pointer', color: '#f6851b'}} onClick={() => fetchWeb3Balance(user.wallet_address)}>🔄</span>
                             </p>
                             <h3 style={{fontSize: '1.5rem', color: '#f6851b'}}>{parseFloat(web3Balance).toFixed(4)} <span style={{fontSize: '0.9rem', color: '#64748b', fontWeight: '500'}}>ETH</span></h3>
                        </div>
                        <div style={{background: 'rgba(0,0,0,0.02)', padding: '1.5rem', borderRadius: '12px', gridColumn: '1 / -1'}}>
                             <p className="input-label">Số điện hiện có (kWh)</p>
                             <h3 style={{fontSize: '1.5rem'}}>{user.energy_balance.toFixed(2)} <span style={{fontSize: '0.9rem', color: '#64748b', fontWeight: '500'}}>kWh</span></h3>
                        </div>
                    </div>
                    
                    <div style={{marginTop: '2rem'}}>
                        <button 
                            onClick={() => {
                                setUser(null);
                                setUsername('');
                                setPassword('');
                                localStorage.clear();
                                if(ws.current) ws.current.close();
                            }} 
                            className="btn-danger" 
                            style={{width: '100%', padding: '1rem'}}
                        >
                            Đăng Xuất Khỏi Node
                        </button>
                    </div>
                </div>
            </div>
        )}

        {view === 'home' && (
            <div className="card home-view" style={{animation: 'slideUp 0.5s ease'}}>
                <div style={{padding: '2rem'}}>
                    <h1 className="text-gradient" style={{fontSize: '3rem', marginBottom: '1.5rem'}}>Tương Lai của Năng Lượng Xanh</h1>
                    <p style={{fontSize: '1.2rem', color: '#64748b', maxWidth: '800px', lineHeight: '1.6'}}>
                        Eco-Exchange là nền tảng giao dịch năng lượng tải phân tán (P2P) tiên tiến, 
                        sử dụng công nghệ Blockchain để đảm bảo tính minh bạch và bảo mật. 
                        Chúng tôi giúp các hộ gia đình và doanh nghiệp tự sản xuất năng lượng tái tạo 
                        có thể bán trực tiếp cho những người cần, tối ưu hóa hiệu quả và giảm thiểu lãng phí.
                    </p>
                    
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem', marginTop: '3rem'}}>
                        <div className="home-feature-card">
                            <span style={{fontSize: '3rem'}}>🔆</span>
                            <h3>Năng Lượng Sạch</h3>
                            <p>Ưu tiên các nguồn năng lượng tái tạo như mặt trời, gió và sinh khối.</p>
                        </div>
                        <div className="home-feature-card">
                            <span style={{fontSize: '3rem'}}>⛓️</span>
                            <h3>Blockchain & Smart Escrow</h3>
                            <p>Giao dịch an toàn, không cần trung gian, thanh toán tức thì.</p>
                        </div>
                        <div className="home-feature-card">
                            <span style={{fontSize: '3rem'}}>📈</span>
                            <h3>Thị Trường Tự Do</h3>
                            <p>Giá cả được quyết định bởi cung cầu thực tế trên lưới điện.</p>
                        </div>
                    </div>

                    <button className="btn-nav active" style={{marginTop: '3rem', padding: '1rem 2rem'}} onClick={() => setView('dashboard')}>
                        Bắt đầu Giao dịch Ngay ➔
                    </button>
                </div>
            </div>
        )}

        {view === 'dashboard' && (
            <>
        {/* CHART AREA */}
        <div className="card chart-area">
            <div className="card-title">
                <span style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>📈 Analytics: Xu Hướng Giá Năng Lượng Nhâm Nhi</span>
                <div style={{display: 'flex', gap: '1rem', fontSize:'0.9rem', background:'rgba(0,0,0,0.03)', padding:'0.5rem 1rem', borderRadius:'20px'}}>
                    <div>Spot: <strong style={{color:'var(--primary)', fontSize:'1.1rem'}}>${stats.current_price}</strong></div>
                    <div>24h Vol: <strong>{stats.total_volume} kWh</strong></div>
                </div>
            </div>
            <div style={{ height: '420px', width: '100%', marginTop: '1rem' }}>
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                            <XAxis dataKey="time" tick={{fontSize: 11, fill: '#64748b'}} axisLine={false} tickLine={false} />
                            <YAxis tick={{fontSize: 11, fill: '#64748b'}} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}/>
                            <Area type="monotone" dataKey="price" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div style={{display:'flex', height:'100%', alignItems:'center', justifyContent:'center', color:'#94a3b8'}}>
                        Đang lắng nghe Block đầu tiên từ lưới truyền tải điện...
                    </div>
                )}
            </div>
        </div>

        {/* ORDERBOOK AREA */}
        <div className="card orderbook-area">
            <div className="card-title" style={{marginBottom: '0'}}>Sổ Lệnh (Order Book)</div>
            
            <div style={{marginTop:'1rem'}}>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', fontSize:'0.8rem', color:'#64748b', paddingBottom:'0.5rem', fontWeight:'700', textTransform:'uppercase'}}>
                    <span>Giá ($)</span>
                    <span style={{textAlign:'right'}}>Khối Lượng</span>
                </div>
                <div style={{height:'180px', overflowY:'auto', paddingRight:'0.5rem', display:'flex', flexDirection:'column-reverse'}}>
                    {sellOrdersAgg.map(o => (
                        <div key={o.price} className="list-item" style={{color: 'var(--danger)', gridTemplateColumns:'1fr 1fr', display:'grid'}}>
                            <strong style={{fontWeight:'800'}}>${o.price.toFixed(2)}</strong>
                            <span style={{textAlign:'right'}}>{o.amount.toFixed(1)} kWh</span>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{textAlign:'center', fontSize:'1.4rem', fontWeight:'800', margin:'1rem 0', color:'var(--primary)', background:'rgba(0,200,83,0.05)', padding:'0.5rem', borderRadius:'8px', border:'1px solid rgba(0,200,83,0.1)'}}>
                ${stats.current_price} <span style={{fontSize:'0.9rem', color:'#64748b', fontWeight:'500'}}>Mark Price</span>
            </div>

            <div>
                <div style={{height:'180px', overflowY:'auto', paddingRight:'0.5rem'}}>
                    {buyOrdersAgg.map(o => (
                        <div key={o.price} className="list-item" style={{color: 'var(--primary)', gridTemplateColumns:'1fr 1fr', display:'grid'}}>
                            <strong style={{fontWeight:'800'}}>${o.price.toFixed(2)}</strong>
                            <span style={{textAlign:'right'}}>{o.amount.toFixed(1)} kWh</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* TRADING PANEL */}
        <div className="card panel-area">
            <div className="card-title">Mở Trạng Thái (Spot)</div>
            
            <div style={{display:'flex', background:'#f1f5f9', borderRadius:'12px', padding:'0.25rem', marginBottom:'1.5rem'}}>
                <button 
                  style={{flex: 1, backgroundColor: orderType === 'buy' ? 'var(--primary)' : 'transparent', color: orderType === 'buy' ? '#fff' : '#64748b', boxShadow: 'none'}}
                  onClick={() => setOrderType('buy')}
                >Mua Điện</button>
                <button 
                  style={{flex: 1, backgroundColor: orderType === 'sell' ? 'var(--danger)' : 'transparent', color: orderType === 'sell' ? '#fff' : '#64748b', boxShadow: 'none'}}
                  onClick={() => setOrderType('sell')}
                >Xả Năng Lượng</button>
            </div>

            <form onSubmit={handlePlaceOrder}>
                <div>
                    <label className="input-label" style={{display:'flex', justifyContent:'space-between'}}>
                        <span>Giá Giới Hạn (Limit Price)</span>
                        <span style={{color:'var(--primary)', cursor:'pointer', textTransform:'none', fontSize:'0.75rem'}} onClick={()=>setPrice(orderType==='buy' ? stats.recommended_buy : stats.recommended_sell)}>🪄 Điền Giá AI Gợi Ý</span>
                    </label>
                    <div style={{position:'relative'}}>
                        <input type="number" step="0.1" value={price} onChange={e=>setPrice(e.target.value)} required style={{paddingRight:'3rem'}} />
                        <span style={{position:'absolute', right:'1rem', top:'13px', color:'#94a3b8', fontWeight:'600'}}>USDT</span>
                    </div>
                </div>
                <div>
                    <label className="input-label">Khối lượng Giải Ước (Amount)</label>
                    <div style={{position:'relative'}}>
                        <input type="number" step="0.1" value={amount} onChange={e=>setAmount(e.target.value)} required style={{paddingRight:'3rem'}} />
                        <span style={{position:'absolute', right:'1rem', top:'13px', color:'#94a3b8', fontWeight:'600'}}>kWh</span>
                    </div>
                    <div style={{display:'flex', gap:'0.5rem', marginTop:'0.5rem', marginBottom:'1.5rem'}}>
                        {[25, 50, 75, 100].map(p => (
                            <button type="button" key={p} onClick={()=>handlePercent(p)} className="btn-outline" style={{padding:'0.4rem 0', flex:1, fontSize:'0.75rem', borderRadius:'6px'}}>
                                {p === 100 ? 'Max' : `${p}%`}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'1.5rem', background:'rgba(0,0,0,0.02)', padding:'1rem', borderRadius:'12px'}}>
                    <span style={{fontWeight:'600', color:'#64748b'}}>Ước tính Tạm giữ:</span>
                    <span style={{fontWeight:'800', fontSize:'1.2rem'}} className="text-gradient">${(parseFloat(amount||0) * parseFloat(price||0)).toFixed(2)}</span>
                </div>
                <button type="submit" style={{width:'100%', height:'54px', backgroundColor: orderType === 'buy' ? 'var(--primary)' : 'var(--danger)', boxShadow: orderType === 'buy' ? '0 8px 25px rgba(0,200,83,0.3)' : '0 8px 25px rgba(239,68,68,0.3)'}}>
                    {orderType === 'buy' ? 'Hợp Đồng Mua Lưới Điện' : 'Đóng Lệnh Bán Điện'}
                </button>
            </form>
            
            <h4 style={{marginTop:'2rem', marginBottom:'1rem', fontSize:'1rem'}}>Pending Orders (Lệnh Chờ)</h4>
            <div style={{maxHeight:'200px', overflowY:'auto'}}>
                {orders.filter(o => o.user_id === user.id && o.status === 'open').length === 0 ? (
                    <div style={{color:'#94a3b8', fontSize:'0.85rem', textAlign:'center', padding:'1rem 0'}}>Chưa có lệnh nào đang chờ khớp.</div>
                ) : orders.filter(o => o.user_id === user.id && o.status === 'open').map(o => (
                    <div key={o.id} className="list-item" style={{alignItems:'center', background:'var(--white)', padding:'0.75rem', marginBottom:'0.5rem', border:'1px solid rgba(0,0,0,0.05)'}}>
                        <div>
                            <span className={o.type === 'buy' ? 'badge badge-buy' : 'badge badge-sell'} style={{marginBottom:'0.25rem'}}>{o.type === 'buy' ? 'MUA' : 'BÁN'}</span>
                            <div style={{fontWeight:'600', fontSize:'0.9rem'}}>{o.amount} <span style={{color:'#64748b', fontWeight:'400'}}>kWh</span> @ ${o.price}</div>
                        </div>
                        <button className="btn-outline" style={{padding:'0.4rem 0.8rem', fontSize:'0.8rem', borderColor:'#64748b', color:'#64748b'}} onClick={() => handleCancelOrder(o.id)}>Cancel</button>
                    </div>
                ))}
            </div>
        </div>

        {/* DIRECT TRANSFER PANEL - SEPARATED */}
        <div className="card direct-transfer-area" style={{height: 'fit-content'}}>
            <div className="card-title">🤝 Chuyển Năng Lượng P2P</div>
            <p style={{fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem'}}>Chuyển trực tiếp năng lượng của bạn tới một Node khác thông qua địa chỉ Ví, thu lại USDT ngay lập tức (ưu đãi phí gas 0.5%).</p>
            
            <form onSubmit={handleDirectTransfer}>
                 <label className="input-label">Địa chỉ Ví Người Nhận</label>
                 <input type="text" placeholder="e.g. 0xabcdef1234..." value={recipientWallet} onChange={e=>setRecipientWallet(e.target.value)} required />
                 
                 <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
                    <div>
                        <label className="input-label" style={{whiteSpace: 'nowrap'}}>Lượng (kWh)</label>
                        <input type="number" step="0.1" value={directAmount} onChange={e=>setDirectAmount(e.target.value)} required />
                    </div>
                    <div>
                        <label className="input-label" style={{whiteSpace: 'nowrap'}}>Đơn giá ($)</label>
                        <input type="number" step="0.1" value={directPrice} onChange={e=>setDirectPrice(e.target.value)} required />
                    </div>
                 </div>
                 
                 <div style={{display:'flex', justifyContent:'space-between', marginBottom:'1.5rem', padding:'1rem', borderRadius:'8px', border:'1px dashed #e2e8f0'}}>
                    <span style={{fontWeight:'600', color:'#64748b', fontSize: '0.85rem'}}>Tổng USDT bạn sẽ nhận:</span>
                    <span style={{fontWeight:'800', fontSize:'1.1rem'}} className="text-gradient">${(parseFloat(directAmount||0) * parseFloat(directPrice||0)).toFixed(2)}</span>
                 </div>
                 
                 <button type="submit" className="btn-outline" style={{width:'100%', background:'linear-gradient(135deg, #009c41, #00C853)', color:'#fff', border:'none', height: '50px'}}>Xác Nhận Chuyển</button>
            </form>
        </div>

        {/* HISTORY & BLOCKS */}
        <div className={`card history-area`} style={{ 
            transition: 'all 0.5s ease',
            height: 'fit-content'
        }}>
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🌐 Blockchain Explorer: Giao dịch Lưới Điện</span>
                <button 
                    onClick={() => setIsHistoryExpanded(!isHistoryExpanded)} 
                    className="btn-outline" 
                    style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', border: '1px solid var(--primary)' }}
                >
                    {isHistoryExpanded ? '🔼 Thu gọn' : '🔽 Xem thêm / Cuộn tin'}
                </button>
            </div>
            
            <div style={{ 
                overflowX: 'auto', 
                maxHeight: isHistoryExpanded ? '600px' : '320px', 
                overflowY: 'auto',
                transition: 'max-height 0.4s ease-in-out',
                marginTop: '1rem',
                border: '1px solid rgba(0,0,0,0.03)',
                borderRadius: '12px'
            }}>
                <table>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--white)', zIndex: 10 }}>
                        <tr>
                            <th>Thời gian</th>
                            <th>Mã Băm / Tx Hash</th>
                            <th>Thực Thi</th>
                            <th>Khối lượng</th>
                            <th>Gas Fee</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                    Đang đồng bộ hóa dữ liệu chuỗi khối...
                                </td>
                            </tr>
                        ) : [...transactions].map(t => (
                            <tr key={t.id}>
                                <td style={{color:'#64748b', fontWeight:'500', whiteSpace: 'nowrap'}}>{new Date(t.timestamp + 'Z').toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute:'2-digit', second:'2-digit' })}</td>
                                <td><span className="badge badge-hash" title={t.tx_hash} style={{ fontSize: '0.7rem' }}>{t.tx_hash?.substring(0, 10)}...</span></td>
                                <td style={{ fontSize: '0.85rem' }}>
                                    <span style={{fontWeight:'600'}}>Node #{t.buyer_id}</span> 
                                    <span style={{margin: '0 8px', opacity: 0.5}}>⚡</span> 
                                    <span style={{fontWeight:'600'}}>Node #{t.seller_id}</span>
                                </td>
                                <td style={{color:'var(--primary)', fontWeight:'800', whiteSpace: 'nowrap'}}>
                                    {t.amount.toFixed(1)} kWh <span style={{fontWeight: 400, color: '#94a3b8', fontSize: '0.8rem'}}>@ ${t.price}</span>
                                </td>
                                <td style={{ textAlign: 'right' }}><span style={{color:'var(--danger)', fontWeight:'600', fontSize: '0.8rem', background: 'rgba(239,68,68,0.05)', padding: '2px 8px', borderRadius: '4px'}}>-${t.gas_fee?.toFixed(2)}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {!isHistoryExpanded && transactions.length > 5 && (
                <div style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.8rem', color: '#64748b', borderTop: '1px solid rgba(0,0,0,0.03)' }}>
                    Cuộn để xem thêm giao dịch cũ hơn
                </div>
            )}
        </div>
      </>
    )}
</div>
  );
}

export default App;
