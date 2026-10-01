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
├── hoat-dong-ngoai-gio/
│   ├── index.html            Trang mục lục Hoạt động ngoài giờ
│   └── huong-dan-thi-atgt/   Hướng dẫn đăng ký và thi ATGT (index.html tự chứa)
├── scripts/publish-slides.py Đồng bộ slide từ project nguồn
└── README.md
```

| Chuyên mục          | URL                      | Trạng thái |
|---------------------|--------------------------|------------|
| Tin học 6 / 7 / 8   | `/tin-hoc-6/` …          | Có slide   |
| Một bài             | `/tin-hoc-6/bai-2/`      | Link gửi trực tiếp cho học sinh được |
| Hoạt động ngoài giờ | `/hoat-dong-ngoai-gio/`  | Có hướng dẫn thi ATGT |
| Đội tuyển Tin học   | `/doi-tuyen/`            | Roadmap thuật toán lớp 6 → 9 → HSG / chuyên |
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

**AI giảng bài** (lời giảng tự động, MP3 tạo sẵn bằng Edge TTS — đang thử trên Tin học 6 Bài 4):
xem [docs/AI-NARRATION.md](docs/AI-NARRATION.md). Tạo audio: `python scripts/generate-narration.py 6/4`.

## Hoạt động ngoài giờ

Nguồn: `GiaoTrinh-GiaoAn-PP/Hoat-Dong-Ngoai-Gio/`. Mỗi hướng dẫn là một file HTML tự chứa, copy vào
`hoat-dong-ngoai-gio/<ten-muc>/index.html` (vd. `Huong-Dan-Thi-ATGT.html` → `huong-dan-thi-atgt/index.html`),
rồi thêm một `<li class="card lesson">` vào `hoat-dong-ngoai-gio/index.html`.

## Roadmap Đội tuyển Tin (`/doi-tuyen/`)

Bản đồ kiến thức thuật toán C++ lớp 6 → 9 → HSG / chuyên Tin. Ba phần tách riêng:

| File | Vai trò |
|------|---------|
| `assets/data/competitive-roadmap.js` | **Dữ liệu**: giai đoạn, nhánh, độ khó và toàn bộ chủ đề. Thêm/sửa chủ đề, quan hệ "cần biết trước", slide, bài tập, link OJ **chỉ sửa file này** (hướng dẫn từng trường ở đầu file). |
| `assets/js/roadmap.js` | Vẽ sơ đồ, đường nối, bộ lọc, bảng chi tiết từ dữ liệu. |
| `assets/css/roadmap.css` | Giao diện riêng của trang roadmap. |

- Mỗi chủ đề có link riêng: `/doi-tuyen/#prefix-sum` mở thẳng bảng chi tiết của chủ đề đó.
- "Học tiếp" tự suy ra từ `prerequisites` của các chủ đề khác — không phải ghi hai chiều.
- Tiến độ (chưa học / đang học / đã học) lưu trong `localStorage` của trình duyệt, chưa có tài khoản.
  Khi có backend chỉ cần thay `load()` / `save()` của đối tượng `Progress` trong `roadmap.js`.
- Không ghi URL chưa có thật vào `resources` / `problems`; để trống thì trang hiện "Đang cập nhật".

## Banner đăng ký học lập trình

Banner nổi góc dưới phải (điện thoại: sát đáy) hiện trên **mọi trang**, kể cả slide. Toàn bộ nội dung, link form
và giao diện nằm trong một file: `assets/js/promo-banner.js` — đổi chữ/link thì sửa các hằng ở đầu file đó.

Mỗi trang gắn banner bằng một dòng `<script src="…/assets/js/promo-banner.js" defer></script>` trước `</body>`.
`publish-slides.py` tự thêm dòng này vào mọi trang `.html` còn thiếu sau mỗi lần đồng bộ (slide copy từ nguồn
không có sẵn). Thêm trang mới bằng tay thì chạy:

```sh
python scripts/publish-slides.py --banner-only
```

Người xem bấm `×` thì banner chỉ ẩn tạm trên trang đang mở (không lưu storage): tải lại hoặc sang trang khác
là hiện lại ngay, ở nguyên trang thì sau 3 phút tự hiện lại (`REOPEN_MS`). Tắt banner toàn website: xoá nội dung
file `promo-banner.js` (giữ file rỗng).

## Mở chuyên mục "Đang cập nhật" trên trang chủ

Khi `/robotics/` có nội dung (`/doi-tuyen/` đã mở), sửa card tương ứng trong `index.html` ở gốc
(làm giống card Tin học 6/7/8):

```html
<!-- Trước -->
<li class="card card--soon" id="robotics" ...>
  <div class="card-body"> ... <span class="card-status">Đang cập nhật</span></div>
</li>

<!-- Sau -->
<li class="card" id="robotics" ...>
  <a class="card-body" href="/robotics/"> ... <span class="card-cta">Vào học</span></a>
</li>
```

Đồng thời đổi link trên menu của mọi trang dùng menu chung (trang chủ, `tin-hoc-N/`, `doi-tuyen/`, `hoat-dong-ngoai-gio/`)
từ `#robotics` / `/#robotics` thành `/robotics/`.

Card **Học lập trình** (class `card--external`) là link thật sang <https://thaythangtoantin.com.vn/>,
mở trong tab mới (`target="_blank" rel="noopener noreferrer"`, có chữ ẩn "mở trong tab mới" cho trình đọc màn hình).

## Xem thử trên máy

```sh
python -m http.server 8000
```

Mở <http://localhost:8000/>. (Cần chạy qua server: các link menu dùng đường dẫn bắt đầu bằng `/`.)
