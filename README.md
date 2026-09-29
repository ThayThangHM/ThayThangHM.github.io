# ThayThangHM.github.io
Thầy Thắng Dạy Tin – website học tập Tin học

Website: <https://thaythanghm.github.io/> — GitHub Pages, deploy từ branch `main`, thư mục `/ (root)`.
HTML/CSS/JS thuần, không build.

## Cấu trúc

```text
/
├── index.html            Trang chủ
├── assets/
│   ├── css/style.css     CSS dùng chung
│   ├── js/main.js        Menu gập trên điện thoại
│   └── images/home.png   Ảnh Hero trang chủ
└── README.md
```

## Quy ước URL (dự kiến)

| Chuyên mục          | Thư mục        |
|---------------------|----------------|
| Tin học 6           | `/tin-hoc-6/`  |
| Tin học 7           | `/tin-hoc-7/`  |
| Tin học 8           | `/tin-hoc-8/`  |
| Đội tuyển Tin học   | `/doi-tuyen/`  |
| Hoàng Mai Robotics  | `/robotics/`   |

Mỗi chuyên mục là một thư mục có `index.html` riêng (trang mục lục của chuyên mục đó).
Bài giảng nằm trong thư mục con, mỗi bài một thư mục:

```text
tin-hoc-6/
├── index.html        Danh sách bài của Tin học 6
├── bai-01/index.html
├── bai-02/index.html
└── ...
```

Như vậy trang chủ chỉ cần biết 5 chuyên mục; thêm bài mới chỉ sửa trang `index.html` của chuyên mục đó.

## Mở một chuyên mục trên trang chủ

Các card hiện hiển thị "Đang cập nhật" (không phải link, tránh 404).
Khi thư mục chuyên mục đã có `index.html`, sửa card tương ứng trong `index.html` ở gốc:

```html
<!-- Trước -->
<li class="card card--soon" id="tin-hoc-6" style="--accent: var(--c-blue)">
  <div class="card-body"> ... <span class="card-status">Đang cập nhật</span></div>
</li>

<!-- Sau -->
<li class="card" id="tin-hoc-6" style="--accent: var(--c-blue)">
  <a class="card-body" href="/tin-hoc-6/"> ... <span class="card-cta">Vào học</span></a>
</li>
```

Đồng thời đổi link trên menu từ `#tin-hoc-6` thành `/tin-hoc-6/`.

Card **Học lập trình** (class `card--external`) là link thật sang <https://thaythangtoantin.com.vn/>,
mở trong tab mới (`target="_blank" rel="noopener noreferrer"`, có chữ ẩn "mở trong tab mới" cho trình đọc màn hình).

## Xem thử trên máy

```sh
python -m http.server 8000
```

Mở <http://localhost:8000/>. (Mở trực tiếp `index.html` cũng xem được giao diện, nhưng link "Trang chủ" `/` chỉ đúng khi chạy qua server.)
