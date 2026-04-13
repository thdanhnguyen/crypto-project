const API_URL = "http://127.0.0.1:8000";

export const api = {
    getUser: async (id) => {
        const res = await fetch(`${API_URL}/users/${id}`);
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
        return res.json();
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
        return res.json();
    },
    depositFunds: async (userId, token_amount, energy_amount) => {
        const res = await fetch(`${API_URL}/users/${userId}/deposit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token_amount, energy_amount })
        });
        return res.json();
    },
    placeOrder: async (userId, type, amount, price) => {
        const res = await fetch(`${API_URL}/orders/?user_id=${userId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, amount, price })
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || "Lỗi đặt lệnh");
        }
        return res.json();
    },
    cancelOrder: async (orderId) => {
        const res = await fetch(`${API_URL}/orders/${orderId}`, {
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
        const res = await fetch(`${API_URL}/transfer?user_id=${userId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to_wallet_address: walletAddress, amount, price })
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || "Lỗi chuyển tiền");
        }
        return res.json();
    }
};
