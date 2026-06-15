import React, { useState, useEffect, useRef } from 'react';
import { api } from './api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import toast, { Toaster } from 'react-hot-toast';
import { BrowserProvider, formatEther } from 'ethers';
import { 
    Lightning, Wallet, ChartLineUp, ArrowsLeftRight, 
    User, GlobeHemisphereWest, CaretDown, CaretUp,
    Copy, SignOut, ShieldCheck, Cpu, Leaf, ArrowDownLeft, ArrowUpRight
} from '@phosphor-icons/react';

function App() {
    const [user, setUser] = useState(null);
    const [orders, setOrders] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [stats, setStats] = useState({ current_price: 0, total_volume: 0, recommended_buy: 0, recommended_sell: 0 });
    const ws = useRef(null);

    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
    const [view, setView] = useState('dashboard'); // 'dashboard' or 'home'
    const [web3Balance, setWeb3Balance] = useState("0");

    const [orderType, setOrderType] = useState('buy');
    const [amount, setAmount] = useState('');
    const [price, setPrice] = useState('');

    const [recipientWallet, setRecipientWallet] = useState('');
    const [directAmount, setDirectAmount] = useState('');
    const [directPrice, setDirectPrice] = useState('');

    const [depositToken, setDepositToken] = useState('');
    const [depositEnergy, setDepositEnergy] = useState('');
    const [transactionAction, setTransactionAction] = useState(null); // 'deposit' or 'withdraw'

    const loadData = async (uid) => {
        try {
            if (uid) {
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
        const savedUserId = sessionStorage.getItem('eco_exchange_user_id');
        if (savedUserId && !user) {
            api.getUser(parseInt(savedUserId)).then(u => {
                setUser(u);
                loadData(u.id);
                fetchWeb3Balance(u.wallet_address);
                toast.success(`Node Connected: ${u.name}`);
            }).catch(() => {
                sessionStorage.removeItem('eco_exchange_user_id');
            });
        }

        const wsUrl = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8000/ws';
        ws.current = new WebSocket(wsUrl);
        ws.current.onmessage = (event) => {
            if (event.data === "update") {
                const uid = sessionStorage.getItem('eco_exchange_user_id');
                if (uid) loadData(uid);
            }
        };

        return () => {
            if (ws.current) ws.current.close();
        };
    }, []);

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
            toast.error("Vui lòng cài đặt MetaMask để kết nối Node.");
            return;
        }
        try {
            const provider = new BrowserProvider(window.ethereum);
            await provider.send("eth_requestAccounts", []);
            const signer = await provider.getSigner();
            const address = await signer.getAddress();

            toast.loading("Xác thực chứng chỉ Web3...", { id: "web3Auth" });
            const u = await api.web3Login(address, "dummy_signature");
            setUser(u);
            sessionStorage.setItem('eco_exchange_user_id', u.id);
            toast.success("Kết nối Web3 thành công.", { id: "web3Auth" });

            fetchWeb3Balance(address);
        } catch (err) {
            toast.dismiss("web3Auth");
            toast.error("Lỗi xác thực: " + err.message);
        }
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        try {
            let u;
            if (isRegisterMode) {
                u = await api.registerUser(username, password);
                toast.success("Khởi tạo Node thành công.");
                toast("Đã cấp phát 5M VNĐ & 2000 kWh cho Node mới.");
            } else {
                u = await api.loginUser(username, password);
                toast.success("Kết nối Node thành công.");
            }
            setUser(u);
            sessionStorage.setItem('eco_exchange_user_id', u.id);
            loadData(u.id);
            fetchWeb3Balance(u.wallet_address);
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
            loading: 'Đang xác thực hợp đồng...',
            success: 'Khớp lệnh lưới điện thành công.',
            error: (err) => err.message || 'Lỗi thực thi'
        });
    };

    const handleCancelOrder = async (orderId) => {
        try {
            await api.cancelOrder(orderId);
            toast.success("Hợp đồng đã hủy. Hoàn trả escrow.");
            loadData(user.id);
        } catch (e) {
            toast.error(e.message);
        }
    };

    const handlePercent = (percent) => {
        if (orderType === 'buy') {
            const priceVal = parseFloat(price) || stats.current_price || 1000;
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
            loading: 'Đang xử lý P2P Swap...',
            success: 'Hoàn tất luân chuyển lưới.',
            error: (err) => err.message || 'Lỗi P2P Swap'
        });
    };

    const handleTransaction = async (e) => {
        e.preventDefault();
        const tAmount = parseFloat(depositToken) || 0;
        const eAmount = parseFloat(depositEnergy) || 0;

        if (tAmount < 0 || eAmount < 0) {
            toast.error("Vui lòng nhập số dương!");
            return;
        }
        if (tAmount === 0 && eAmount === 0) {
            toast.error("Vui lòng nhập số lượng hợp lệ.");
            return;
        }

        let payloadToken = transactionAction === 'withdraw' ? -tAmount : tAmount;
        let payloadEnergy = transactionAction === 'withdraw' ? -eAmount : eAmount;

        const promise = api.depositFunds(user.id, payloadToken, payloadEnergy).then((u) => {
            setDepositToken('');
            setDepositEnergy('');
            setTransactionAction(null);
            setUser(u);
            loadData(u.id);
        });
        toast.promise(promise, {
            loading: 'Đang xử lý giao dịch...',
            success: transactionAction === 'withdraw' ? 'Đã rút tài sản thành công.' : 'Đã nạp thành công vào Node.',
            error: (err) => err.message || 'Lỗi xử lý giao dịch'
        });
    };

    const chartData = [...transactions].reverse().map(t => ({
        time: new Date(t.timestamp + 'Z').toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }),
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
        return result.sort((a, b) => b.price - a.price);
    };
    const sellOrdersAgg = getAggregatedOrders('sell');
    const buyOrdersAgg = getAggregatedOrders('buy');

    if (!user) {
        return (
            <div className="auth-container">
                <Toaster position="top-center" className="toaster-custom" />
                <div className="auth-wrapper">
                    <div className="auth-hero">
                        <div className="auth-hero-logo">
                            <Lightning weight="duotone" size={32} color="var(--primary)" />
                            <span>Wattchain</span>
                        </div>

                        <div className="auth-hero-content">
                            <h1>Phân bổ năng lượng<br /><span>Thế hệ Web3</span></h1>
                            <p>Kiến trúc lưới điện phân tán P2P. Giao dịch năng lượng tái tạo không cần định tuyến trung gian. Tối ưu hao phí qua blockchain.</p>
                            
                            <div className="auth-hero-pills">
                                <span className="auth-pill">Zero-Trust Escrow</span>
                                <span className="auth-pill">0.05% TX Fee</span>
                                <span className="auth-pill">Live Market Data</span>
                            </div>
                        </div>
                    </div>

                    <div className="auth-form">
                        <div>
                            <h2>{isRegisterMode ? 'Khởi Tạo Node' : 'Kết Nối Node'}</h2>
                            <p>Sử dụng định danh Web3 để gia nhập lưới.</p>
                        </div>

                        <button type="button" onClick={handleWeb3Login} className="btn-metamask">
                            <Wallet weight="bold" size={20} />
                            Đăng nhập bằng MetaMask
                        </button>

                        <div className="divider">HOẶC DÙNG ĐỊNH DANH CŨ</div>

                        <form onSubmit={handleAuth}>
                            <div>
                                <label className="input-label">Mã định danh hệ thống</label>
                                <input type="text" placeholder="e.g. solarpilot" value={username} onChange={e => setUsername(e.target.value)} required />
                            </div>
                            <div>
                                <label className="input-label">Khóa bảo mật</label>
                                <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                            </div>
                            <button type="submit" style={{ width: '100%', marginTop: '0.5rem' }}>
                                {isRegisterMode ? 'Cấp phép & Khởi tạo' : 'Truy cập Hệ thống'}
                            </button>
                        </form>

                        <div className="auth-toggle">
                            {isRegisterMode ? 'Đã có Node hoạt động? ' : 'Chưa có Node? '}
                            <button onClick={() => setIsRegisterMode(!isRegisterMode)}>
                                {isRegisterMode ? 'Đăng nhập ngay' : 'Đăng ký tham gia lưới'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            <Toaster position="bottom-right" className="toaster-custom" />

            <div className="card header-area">
                <div className="header-brand">
                    <Lightning weight="duotone" size={24} color="var(--primary)" />
                    <h2>Wattchain</h2>
                </div>

                <div className="header-nav">
                    <button onClick={() => setView('home')} className={view === 'home' ? "btn-nav active" : "btn-nav"}>
                        <GlobeHemisphereWest size={18} weight="bold" /> <span>Tổng quan</span>
                    </button>
                    <button onClick={() => setView('dashboard')} className={view === 'dashboard' ? "btn-nav active" : "btn-nav"}>
                        <ChartLineUp size={18} weight="bold" /> <span>Thị trường</span>
                    </button>
                    <button onClick={() => setView('profile')} className={view === 'profile' ? "btn-nav active" : "btn-nav"}>
                        <User size={18} weight="bold" /> <span>Quản lý Node</span>
                    </button>
                </div>

                <div className="header-stats">
                    <div className="stat-box">
                        <span className="stat-label">Thanh khoản Spot</span>
                        <span className="stat-value text-gradient">{user.token_balance.toLocaleString('vi-VN')} VNĐ</span>
                    </div>
                    <div className="stat-box">
                        <span className="stat-label">Kho lưu trữ kWh</span>
                        <span className="stat-value text-gradient" style={{ color: 'var(--text-1)' }}>{user.energy_balance.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginLeft: '0.5rem' }}>
                        <span className="badge badge-hash" title={user.wallet_address}><ShieldCheck size={14} /> {user.wallet_address?.substring(0, 8)}...</span>
                        <span className="badge badge-rep"><Cpu size={14} /> Điểm Uy Tín: {user.reputation_score}</span>
                    </div>
                </div>
            </div>

            {view === 'profile' && (
                <div className="card profile-card">
                    <div className="card-title">
                        <span style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}><User size={18} weight="bold"/> Cấu Hình Node Cục Bộ</span>
                    </div>

                    <div className="profile-row">
                        <p className="input-label">Định danh Node</p>
                        <h3>{user.name}</h3>
                    </div>

                    <div className="profile-row">
                        <p className="input-label">Địa chỉ Mạng Lưới (Wallet)</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                            <code className="badge-hash" style={{ padding: '0.65rem 1rem', fontSize: '0.9rem', flex: 1, borderRadius: '8px' }}>
                                {user.wallet_address}
                            </code>
                            <button className="btn-outline" onClick={() => { navigator.clipboard.writeText(user.wallet_address); toast.success('Đã lưu vào bộ nhớ tạm'); }} style={{ padding: '0.65rem 1rem' }}>
                                <Copy size={16} weight="bold" />
                            </button>
                        </div>
                    </div>

                    <div className="profile-grid">
                        <div className="profile-row" style={{ marginBottom: 0 }}>
                            <p className="input-label">Số Dư VNĐ (VNDT)</p>
                            <h3 className="text-gradient">{user.token_balance.toLocaleString('vi-VN')}</h3>
                        </div>
                        <div className="profile-row" style={{ marginBottom: 0 }}>
                            <p className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Testnet Balance</span>
                                <ArrowsLeftRight size={14} weight="bold" style={{ cursor: 'pointer', color: 'var(--text-2)' }} onClick={() => fetchWeb3Balance(user.wallet_address)} />
                            </p>
                            <h3 style={{ color: 'var(--text-1)' }}>{parseFloat(web3Balance).toFixed(4)} <span style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>ETH</span></h3>
                        </div>
                        <div className="profile-row" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                            <p className="input-label">Khả Năng Xả (Năng lượng hiện có)</p>
                            <h3>{user.energy_balance.toFixed(2)} <span style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>kWh</span></h3>
                        </div>
                    </div>

                    <div className="divider">GIAO DỊCH (NẠP / RÚT)</div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                        <button 
                            className={`btn-tab ${transactionAction === 'deposit' ? 'buy-active' : 'btn-outline'}`} 
                            style={{ flex: 1, padding: '0.65rem', border: transactionAction === 'deposit' ? '1px solid var(--primary)' : '1px solid var(--border)' }}
                            onClick={() => setTransactionAction(transactionAction === 'deposit' ? null : 'deposit')}
                        >
                            <ArrowDownLeft size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '4px' }} /> Nạp Tài Sản
                        </button>
                        <button 
                            className={`btn-tab ${transactionAction === 'withdraw' ? 'sell-active' : 'btn-outline'}`} 
                            style={{ flex: 1, padding: '0.65rem', border: transactionAction === 'withdraw' ? '1px solid var(--danger)' : '1px solid var(--border)' }}
                            onClick={() => setTransactionAction(transactionAction === 'withdraw' ? null : 'withdraw')}
                        >
                            <ArrowUpRight size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '4px' }} /> Rút Tài Sản
                        </button>
                    </div>

                    {transactionAction && (
                        <form onSubmit={handleTransaction} className="profile-row" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', animation: 'slideUp 0.3s ease' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <label className="input-label">{transactionAction === 'deposit' ? 'Nạp VNĐ' : 'Rút VNĐ'}</label>
                                    <div className="input-wrap">
                                        <input type="number" min="0" step="1" value={depositToken} onChange={e => setDepositToken(e.target.value)} placeholder="0" style={{ marginBottom: 0 }} />
                                        <span className="input-unit">VNĐ</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="input-label">{transactionAction === 'deposit' ? 'Nạp Điện' : 'Rút Điện'}</label>
                                    <div className="input-wrap">
                                        <input type="number" min="0" step="0.1" value={depositEnergy} onChange={e => setDepositEnergy(e.target.value)} placeholder="0" style={{ marginBottom: 0 }} />
                                        <span className="input-unit">kWh</span>
                                    </div>
                                </div>
                            </div>
                            <button type="submit" className={transactionAction === 'deposit' ? '' : 'btn-danger'} style={{ marginTop: '0.5rem', width: '100%' }}>
                                {transactionAction === 'deposit' ? 'Xác nhận Nạp' : 'Xác nhận Rút'}
                            </button>
                        </form>
                    )}

                    <button
                        onClick={() => {
                            setUser(null);
                            setUsername('');
                            setPassword('');
                            sessionStorage.clear();
                            if (ws.current) ws.current.close();
                        }}
                        className="btn-outline"
                        style={{ width: '100%', padding: '1rem', marginTop: '1rem', display:'flex', justifyContent:'center', alignItems:'center', gap:'0.5rem' }}
                    >
                        <SignOut size={18} weight="bold" /> Ngắt kết nối Node
                    </button>
                </div>
            )}

            {view === 'home' && (
                <div className="home-view">
                    <div className="home-hero">
                        <h1 className="text-gradient">Kiến trúc lưới điện tự trị.</h1>
                        <p>Eco-Exchange vận hành trên nền tảng Smart Contracts, loại bỏ hoàn toàn các nút thắt tập trung. Bán điện thừa trực tiếp vào lưới, hoặc mua điện sạch giá spot theo thời gian thực.</p>
                        <button onClick={() => setView('dashboard')}>Truy cập Bảng điều khiển</button>
                    </div>

                    <div className="home-bento">
                        <div className="bento-cell wide">
                            <div className="bento-icon"><Lightning size={20} weight="bold" /></div>
                            <div className="bento-big-num">0.05%</div>
                            <h3>Phí giao dịch P2P</h3>
                            <p>Rẻ hơn 90% so với lưới điện truyền thống. Chi phí duy trì hạ tầng được xử lý on-chain.</p>
                        </div>
                        <div className="bento-cell">
                            <div className="bento-icon"><Leaf size={20} weight="bold" /></div>
                            <h3>Chuẩn năng lượng sạch</h3>
                            <p>Chỉ duyệt các Node có chứng chỉ xanh (Solar/Wind) vào hệ thống cung.</p>
                        </div>
                        <div className="bento-cell">
                            <div className="bento-icon"><ShieldCheck size={20} weight="bold" /></div>
                            <h3>Smart Escrow</h3>
                            <p>Tiền và năng lượng được khóa on-chain. Không rủi ro bùng kèo giữa các Node.</p>
                        </div>
                    </div>
                </div>
            )}

            {view === 'dashboard' && (
                <>
                    <div className="card chart-area">
                        <div className="card-title">
                            <span style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}><ChartLineUp size={18} weight="bold"/> Biến Động Spot Price</span>
                            <div className="chart-meta">
                                <div><span className="chart-price">{stats.current_price.toLocaleString('vi-VN')}</span> <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>VNĐ</span></div>
                                <div className="chart-vol">Vol: {stats.total_volume} kWh</div>
                            </div>
                        </div>
                        <div style={{ height: '360px', width: '100%', marginTop: '1.5rem' }}>
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
                                                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                        <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#8B9BB4' }} axisLine={false} tickLine={false} dy={10} />
                                        <YAxis tick={{ fontSize: 11, fill: '#8B9BB4' }} axisLine={false} tickLine={false} dx={-10} />
                                        <Tooltip 
                                            contentStyle={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-1)' }} 
                                            itemStyle={{ color: 'var(--primary)', fontWeight: 600 }}
                                        />
                                        <Area type="monotone" dataKey="price" stroke="var(--primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="empty-state">
                                    <Lightning size={32} color="var(--text-3)" />
                                    <span>Đang đồng bộ Block dữ liệu lưới điện...</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="card orderbook-area">
                        <div className="card-title">Sổ Lệnh (Order Book)</div>
                        <div className="ob-header">
                            <span>Mức Giá (VNĐ)</span>
                            <span style={{ textAlign: 'right' }}>Khối Lượng</span>
                        </div>
                        <div style={{ height: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse' }}>
                            {sellOrdersAgg.map(o => (
                                <div key={o.price} className="ob-row sell-row">
                                    <strong>{o.price.toLocaleString('vi-VN')}</strong>
                                    <span>{o.amount.toFixed(1)} kWh</span>
                                </div>
                            ))}
                        </div>

                        <div className="ob-mark">
                            {stats.current_price.toLocaleString('vi-VN')} <span>VNĐ Mark</span>
                        </div>

                        <div style={{ height: '160px', overflowY: 'auto' }}>
                            {buyOrdersAgg.map(o => (
                                <div key={o.price} className="ob-row buy-row">
                                    <strong>{o.price.toLocaleString('vi-VN')}</strong>
                                    <span>{o.amount.toFixed(1)} kWh</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="card panel-area">
                        <div className="card-title">Thực Thi Lệnh Hợp Đồng</div>

                        <div className="tab-switcher">
                            <button className={`btn-tab ${orderType === 'buy' ? 'buy-active' : ''}`} onClick={() => setOrderType('buy')}>
                                Mua Năng Lượng
                            </button>
                            <button className={`btn-tab ${orderType === 'sell' ? 'sell-active' : ''}`} onClick={() => setOrderType('sell')}>
                                Bán Trả Lưới
                            </button>
                        </div>

                        <form onSubmit={handlePlaceOrder}>
                            <div>
                                <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Giá Đặt Hợp Đồng</span>
                                    <span style={{ color: 'var(--text-2)', cursor: 'pointer', textTransform: 'none' }} onClick={() => setPrice(orderType === 'buy' ? stats.recommended_buy : stats.recommended_sell)}>🪄 AI Gợi ý</span>
                                </label>
                                <div className="input-wrap">
                                    <input type="number" step="1" value={price} onChange={e => setPrice(e.target.value)} required />
                                    <span className="input-unit">VNĐ</span>
                                </div>
                            </div>

                            <div>
                                <label className="input-label">Khối Lượng Yêu Cầu</label>
                                <div className="input-wrap">
                                    <input type="number" step="0.1" value={amount} onChange={e => setAmount(e.target.value)} required />
                                    <span className="input-unit">kWh</span>
                                </div>
                            </div>

                            <div className="percent-btns">
                                {[25, 50, 75, 100].map(p => (
                                    <button type="button" key={p} onClick={() => handlePercent(p)} className="percent-btn">
                                        {p === 100 ? 'Max' : `${p}%`}
                                    </button>
                                ))}
                            </div>

                            <div className="estimate-box">
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-2)', fontWeight: 600 }}>Dự kiến giao dịch:</span>
                                <span className="text-gradient" style={{ fontSize: '1.2rem', fontWeight: 800 }}>{(parseFloat(amount || 0) * parseFloat(price || 0)).toLocaleString('vi-VN')} VNĐ</span>
                            </div>

                            <button type="submit" className={orderType === 'buy' ? '' : 'btn-danger'} style={{ width: '100%', height: '52px' }}>
                                {orderType === 'buy' ? 'Xác nhận Mua' : 'Xác nhận Xả Lưới'}
                            </button>
                        </form>

                        <div className="divider">LỆNH CHỜ KHỚP (PENDING)</div>
                        <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                            {orders.filter(o => o.user_id === user.id && o.status === 'open').length === 0 ? (
                                <div className="empty-state" style={{ padding: '1.5rem' }}>Trống.</div>
                            ) : orders.filter(o => o.user_id === user.id && o.status === 'open').map(o => (
                                <div key={o.id} className="pending-item">
                                    <div>
                                        <span className={o.type === 'buy' ? 'badge badge-buy' : 'badge badge-sell'} style={{ marginBottom: '0.4rem' }}>{o.type === 'buy' ? 'MUA' : 'BÁN'}</span>
                                        <div className="pending-item-info">{o.amount} <span>kWh</span> @ {o.price.toLocaleString('vi-VN')} <span>VNĐ</span></div>
                                    </div>
                                    <button className="btn-outline" style={{ padding: '0.4rem 0.65rem', fontSize: '0.8rem' }} onClick={() => handleCancelOrder(o.id)}>Hủy</button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="card direct-transfer-area">
                        <div className="card-title"><span style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}><ArrowsLeftRight size={18} weight="bold"/> Chuyển P2P Trực Tiếp</span></div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginBottom: '1.5rem', lineHeight: 1.5 }}>Đẩy năng lượng thẳng tới một Node cụ thể qua Wallet Address để nhận VNĐ tức thì.</p>

                        <form onSubmit={handleDirectTransfer}>
                            <label className="input-label">Địa Chỉ Wallet Nhận</label>
                            <input type="text" placeholder="0x..." value={recipientWallet} onChange={e => setRecipientWallet(e.target.value)} required />

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <label className="input-label">Lượng</label>
                                    <div className="input-wrap">
                                        <input type="number" step="0.1" value={directAmount} onChange={e => setDirectAmount(e.target.value)} required />
                                        <span className="input-unit">kWh</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="input-label">Đơn giá</label>
                                    <div className="input-wrap">
                                        <input type="number" step="1" value={directPrice} onChange={e => setDirectPrice(e.target.value)} required />
                                        <span className="input-unit">VNĐ</span>
                                    </div>
                                </div>
                            </div>

                            <div className="estimate-box">
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-2)', fontWeight: 600 }}>Khối lượng VNĐ nhận:</span>
                                <span className="text-gradient" style={{ fontSize: '1.1rem', fontWeight: 800 }}>{(parseFloat(directAmount || 0) * parseFloat(directPrice || 0)).toLocaleString('vi-VN')}</span>
                            </div>

                            <button type="submit" style={{ width: '100%', height: '50px' }}>Thực thi P2P Swap</button>
                        </form>
                    </div>

                    <div className="card history-area">
                        <div className="card-title">
                            <span>Sổ Cái Chuỗi Khối (Ledger)</span>
                            <button className="btn-nav" onClick={() => setIsHistoryExpanded(!isHistoryExpanded)} style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}>
                                {isHistoryExpanded ? 'Thu gọn' : 'Mở rộng'}
                            </button>
                        </div>

                        <div className="table-wrap" style={{ maxHeight: isHistoryExpanded ? '600px' : '300px', transition: 'max-height 0.4s ease' }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Thời gian</th>
                                        <th>Mã Băm / Hash</th>
                                        <th>Luồng Giao Dịch</th>
                                        <th>Khối lượng</th>
                                        <th style={{ textAlign: 'right' }}>Gas Fee</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-3)' }}>Đang đồng bộ Block...</td>
                                        </tr>
                                    ) : [...transactions].map(t => (
                                        <tr key={t.id}>
                                            <td className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{new Date(t.timestamp + 'Z').toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                                            <td><span className="badge-hash" style={{ padding: '0.2rem 0.4rem', borderRadius: '4px' }}>{t.tx_hash?.substring(0, 8)}...</span></td>
                                            <td style={{ fontSize: '0.85rem' }}>
                                                <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>Node_{t.buyer_id}</span>
                                                <ArrowsLeftRight size={12} weight="bold" style={{ margin: '0 6px', color: 'var(--text-3)', verticalAlign: 'middle' }} />
                                                <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>Node_{t.seller_id}</span>
                                            </td>
                                            <td style={{ color: 'var(--primary)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                {t.amount.toFixed(1)} kWh <span style={{ color: 'var(--text-3)', fontSize: '0.75rem', fontWeight: 500 }}>@ {t.price.toLocaleString('vi-VN')}</span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <span style={{ color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 600, background: 'var(--danger-dim)', padding: '2px 6px', borderRadius: '4px' }}>
                                                    -{t.gas_fee?.toLocaleString('vi-VN')}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default App;
