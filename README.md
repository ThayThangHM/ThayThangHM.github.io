# ThayThangHM.github.io
Thầy Thắng Dạy Tin – website học tập Tin học

Website: <https://thaythanghm.github.io/> — GitHub Pages, deploy từ branch `main`, thư mục `/ (root)`.
HTML/CSS/JS thuần, không build.

## Cấu trúc

```text
/
├── index.html                Trang chủ
├── assets/                   CSS/JS/ảnh dùng chung của website
├── tin-hoc-6/
│   ├── index.html            Trang mục lục Tin học 6
│   ├── bai-1/                Slide Bài 1 (index.html, styles.css, slides.js, assets/)
│   └── ...
├── tin-hoc-7/                (tương tự)
├── tin-hoc-8/                (tương tự)
├── scripts/publish-slides.py Đồng bộ slide từ project nguồn
└── README.md
```

| Chuyên mục          | URL                      | Trạng thái |
|---------------------|--------------------------|------------|
| Tin học 6 / 7 / 8   | `/tin-hoc-6/` …          | Có slide   |
| Một bài             | `/tin-hoc-6/bai-2/`      | Link gửi trực tiếp cho học sinh được |
| Đội tuyển Tin học   | `/doi-tuyen/` (dự kiến)  | Đang cập nhật |
| Hoàng Mai Robotics  | `/robotics/` (dự kiến)   | Đang cập nhật |
| Học lập trình       | <https://thaythangtoantin.com.vn/> | Link ngoài, mở tab mới |

## Đăng slide bài giảng

Slide **gốc** nằm ở project `GiaoTrinh-GiaoAn-PP` (cùng thư mục cha với repo này):
`Tin-Hoc-{6,7,8}/SlideHTML/Bai-XX/`. Không sửa slide trong repo này — sửa ở nguồn rồi chạy lại script.

```sh
python scripts/publish-slides.py --dry-run   # xem trước
python scripts/publish-slides.py             # đồng bộ
```

Script:

- bỏ qua các bài trong `EXCLUDE` ở đầu script (hiện là Bài mở đầu `Bai-00`);
- copy mỗi `Bai-XX/` còn lại sang `tin-hoc-N/bai-X/` (Bai-01 → bai-1, Bai-02 → bai-2, …) nguyên bản:
  `index.html`, file `.css`/`.js` cùng cấp và thư mục `assets/` — file khác (ghi chú, nháp) không copy;
- bỏ qua bài có đường dẫn tuyệt đối/local, URL Internet hoặc thiếu file (in lý do);
- lấy tên bài từ chính slide (`<title>` hoặc dòng "Bài N — …" trên slide bìa);
- tạo lại danh sách bài trong `tin-hoc-N/index.html` giữa `<!-- LESSONS:BEGIN -->` và `<!-- LESSONS:END -->`;
- không xoá bài đã publish nếu nguồn không còn (chỉ cảnh báo), không commit, không push.

Nguồn ở chỗ khác: `python scripts/publish-slides.py --source "D:/duong/dan/GiaoTrinh-GiaoAn-PP"`.

## Mở chuyên mục "Đang cập nhật" trên trang chủ

Khi `/doi-tuyen/` hoặc `/robotics/` có nội dung, sửa card tương ứng trong `index.html` ở gốc
(làm giống card Tin học 6/7/8):

```html
<!-- Trước -->
<li class="card card--soon" id="doi-tuyen" ...>
  <div class="card-body"> ... <span class="card-status">Đang cập nhật</span></div>
</li>

<!-- Sau -->
<li class="card" id="doi-tuyen" ...>
  <a class="card-body" href="/doi-tuyen/"> ... <span class="card-cta">Vào học</span></a>
</li>
```

Đồng thời đổi link trên menu (trang chủ và 3 trang `tin-hoc-N/`) từ `#doi-tuyen` / `/#doi-tuyen` thành `/doi-tuyen/`.

Card **Học lập trình** (class `card--external`) là link thật sang <https://thaythangtoantin.com.vn/>,
mở trong tab mới (`target="_blank" rel="noopener noreferrer"`, có chữ ẩn "mở trong tab mới" cho trình đọc màn hình).

## Xem thử trên máy

```sh
python -m http.server 8000
```

Mở <http://localhost:8000/>. (Cần chạy qua server: các link menu dùng đường dẫn bắt đầu bằng `/`.)
