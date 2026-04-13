# Nền Tảng Giao Dịch Năng Lượng P2P (Mô Phỏng Crypto) ⚡🌱

Dự án này là một hệ thống mô phỏng **Chợ Giao Dịch Năng Lượng Ngang Hàng (P2P)**, nơi các hộ gia đình hoặc cá nhân có thể trao đổi, mua bán năng lượng tái tạo (điện mặt trời dư thừa) một cách dễ dàng và minh bạch. 

Dự án áp dụng các nguyên lý tiên tiến của Blockchain và Crypto vào thực tiễn:
- **Token hoá Năng Lượng:** 1 kWh = 1 Energy Token, biến điện năng thành tài sản số có thể giao dịch.
- **Smart Contract (Hợp đồng thông minh) mô phỏng:** Tự động hoá hoàn toàn việc khớp lệnh, chuyển tiền, giao năng lượng và lưu trữ lịch sử giao dịch một cách minh bạch.
- **Cơ chế Escrow (Ký Quỹ):** Khóa token hoặc năng lượng ngay khi đặt lệnh để đảm bảo tính an toàn cho cả hai bên.

## ✨ Tính Năng Nổi Bật
- **Hệ thống Đăng ký / Đăng nhập** an toàn và dễ sử dụng.
- **Ví Năng Lượng:** Theo dõi số dư Token và Năng Lượng (kWh).
- **Giao dịch theo nhiều mức giá:** Tự động khớp lệnh tốt nhất dựa trên các quy tắc ưu tiên.
- **Điểm Uy Tín (Reputation Score):** Tặng thưởng uy tín cho những giao dịch thành công.
- **Lịch sử giao dịch minh bạch:** Lưu trữ lịch sử không thể thay đổi, tương tự sổ cái blockchain.
- **Tính thẩm mỹ cao:** Thiết kế theo chuẩn đúng 4 màu Neon-Green với các hiệu ứng chuyển động và nền sinh động.
- **Ngôn ngữ:** Hỗ trợ Tiếng Việt thân thiện.

## 🚀 Hướng Dẫn Cài Đặt

### 1. Cài đặt Backend (Python)
Đảm bảo bạn đã cài đặt Python 3.9+
```bash
# Cài đặt thư viện
pip install -r requirements.txt

# Khởi chạy server
python -m uvicorn main:app --reload
```
Server chạy tại: `http://127.0.0.1:8000`

### 2. Cài đặt Frontend (React + Vite)
Đảm bảo bạn đã cài đặt Node.js
```bash
cd frontend

# Cài đặt thư viện
npm install

# Khởi chạy ứng dụng Web
npm run dev
```
Web app sẽ tự khởi chạy trên trình duyệt của bạn (thường ở cổng 5173).

## 🎨 Thông Tin Giao Diện
Ứng dụng tuân thủ nghiêm ngặt bảng màu 4 chuẩn do bạn chỉ định:
- `Trắng (#FFFFFF)`
- `Xanh Nhạt (#33FF33)`
- `Xanh Đậm (#00EE00)`
- `Vàng (#FFFF33)`

Cảm ơn bạn đã trải nghiệm mô hình giao dịch năng lượng số P2P!
