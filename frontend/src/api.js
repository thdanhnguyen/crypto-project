const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(cb) {
    refreshSubscribers.push(cb);
}

function onRefreshed(token) {
    refreshSubscribers.forEach(cb => cb(token));
    refreshSubscribers = [];
}

const fetchWithAuth = async (url, options = {}) => {
    let accessToken = localStorage.getItem('eco_access_token');
    
    options.headers = {
        ...options.headers,
    };
    
    if (accessToken) {
        options.headers["Authorization"] = `Bearer ${accessToken}`;
    }

    let res = await fetch(url, options);

    if (res.status === 401 && accessToken) {
        if (!isRefreshing) {
            isRefreshing = true;
            const refreshToken = localStorage.getItem('eco_refresh_token');
            if (refreshToken) {
                try {
                    const rfRes = await fetch(`${API_URL}/refresh`, {
                        method: 'POST',
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ refresh_token: refreshToken, access_token: "dummy", token_type: "dummy" })
                    });
                    if (rfRes.ok) {
                        const newAuth = await rfRes.json();
                        localStorage.setItem('eco_access_token', newAuth.access_token);
                        localStorage.setItem('eco_refresh_token', newAuth.refresh_token);
                        onRefreshed(newAuth.access_token);
                    } else {
                        // Logout
                        localStorage.clear();
                        window.location.reload();
                    }
                } catch(e) {
                    console.error("Lỗi refresh:", e);
                } finally {
                    isRefreshing = false;
                }
            } else {
                isRefreshing = false;
                localStorage.clear();
                window.location.reload();
            }
        }

        // Đợi refresh token mới
        return new Promise((resolve) => {
            subscribeTokenRefresh(token => {
                options.headers['Authorization'] = `Bearer ${token}`;
                resolve(fetch(url, options));
            });
        });
    }
    return res;
};

const handleAuthTokens = (authData) => {
    localStorage.setItem('eco_access_token', authData.access_token);
    localStorage.setItem('eco_refresh_token', authData.refresh_token);
    return authData.user;
};

export const api = {
    getUser: async (id) => {
        const res = await fetchWithAuth(`${API_URL}/users/${id}`);
        if (!res.ok) throw new Error("Không tìm thấy người dùng");
        return res.json();
    },
    registerUser: async (name, password) => {
        const res = await fetch(`${API_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, password })
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || "Lỗi đăng ký");
        }
        const data = await res.json();
        return handleAuthTokens(data);
    },
    loginUser: async (name, password) => {
        const res = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, password })
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || "Lỗi đăng nhập");
        }
        const data = await res.json();
        return handleAuthTokens(data);
    },
    web3Login: async (walletAddress, signature) => {
        const res = await fetch(`${API_URL}/web3_login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet_address: walletAddress, signature })
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || "Lỗi đăng nhập Web3");
        }
        const data = await res.json();
        return handleAuthTokens(data);
    },
    depositFunds: async (userId, token_amount, energy_amount) => {
        const res = await fetchWithAuth(`${API_URL}/users/${userId}/deposit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token_amount, energy_amount })
        });
        if(!res.ok) {
             const error = await res.json().catch(()=>({}));
             throw new Error(error.detail || "Lỗi nạp tiền");
        }
        return res.json();
    },
    placeOrder: async (userId, type, amount, price) => {
        const res = await fetchWithAuth(`${API_URL}/orders/?user_id=${userId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, amount, price })
        });
        if (!res.ok) {
            const error = await res.json().catch(()=>({}));
            throw new Error(error.detail || "Lỗi đặt lệnh");
        }
        return res.json();
    },
    cancelOrder: async (orderId) => {
        const res = await fetchWithAuth(`${API_URL}/orders/${orderId}`, {
            method: "DELETE"
        });
        if (!res.ok) throw new Error("Chỉ có thể hủy lệnh chưa khớp");
        return res.json();
    },
    getOrders: async () => {
        const res = await fetch(`${API_URL}/orders/`);
        return res.json();
    },
    getTransactions: async () => {
        const res = await fetch(`${API_URL}/transactions/`);
        return res.json();
    },
    getMarketStats: async () => {
        const res = await fetch(`${API_URL}/market/stats`);
        return res.json();
    },
    transferFunds: async (userId, walletAddress, amount, price) => {
        const res = await fetchWithAuth(`${API_URL}/transfer?user_id=${userId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to_wallet_address: walletAddress, amount, price })
        });
        if (!res.ok) {
            const error = await res.json().catch(()=>({}));
            throw new Error(error.detail || "Lỗi chuyển tiền");
        }
        return res.json();
    }
};
