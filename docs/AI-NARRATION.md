# AI giảng bài (lời giảng tự động bằng giọng nói)

Học sinh mở slide, bấm **▶ 🎙 AI giảng bài**: máy đọc lời giảng của slide đang xem, đọc xong tự sang slide sau,
cứ thế đến hết bài. Không có avatar hay video, chỉ có âm thanh.

- Giọng đọc: **Microsoft Edge TTS** qua thư viện Python `edge-tts`. Miễn phí, không cần API key.
- Audio được **tạo sẵn thành file MP3** trên máy giáo viên. Website (GitHub Pages) chỉ phát file tĩnh,
  không gọi API hay backend nào khi học sinh xem.
- Đang thử trên **Tin học 6 — Bài 4 (Mạng máy tính)**. Chưa áp dụng cho các bài khác.

## Cấu trúc

Trong thư mục bài **nguồn** (`GiaoTrinh-GiaoAn-PP/Tin-Hoc-N/SlideHTML/Bai-XX/`):

```text
Bai-04/
├── index.html                 + 2 dòng <script> ở cuối (narration-data.js, narration.js)
├── slides.js                  KHÔNG sửa
├── narration.js               player (tự chèn CSS, tự tạo thanh điều khiển)
└── narration/
    ├── script.json            LỜI GIẢNG: giáo viên sửa file này
    ├── narration-data.js      tự sinh: danh sách đoạn audio / khoảng dừng (đừng sửa tay)
    ├── .cache.json            tự sinh: mã băm từng đoạn (để chỉ tạo lại đoạn đã sửa)
    └── audio/
        ├── slide-01.mp3       tự sinh
        ├── slide-03.mp3       đoạn 1 của slide 3
        ├── slide-03-2.mp3     đoạn 2 (sau một [pause] hoặc [step])
        └── ...
```

Tool nằm ở repo website: `scripts/generate-narration.py`. `scripts/publish-slides.py` copy `narration.js`,
`narration/narration-data.js` và `narration/audio/*.mp3` lên website. `script.json` và `.cache.json` không được copy.

## 1. Cài đặt (một lần)

```sh
python -m pip install edge-tts
```

Cần có Internet khi **tạo** audio. Khi học sinh xem bài thì không cần gì thêm.

## 2. Chọn giọng

```sh
python scripts/generate-narration.py --list-voices
```

Edge TTS hiện có 2 giọng tiếng Việt:

| Giọng                 | Giới tính | Ghi chú                          |
|-----------------------|-----------|----------------------------------|
| `vi-VN-NamMinhNeural` | Nam       | **Đang dùng**: hợp vai "thầy"    |
| `vi-VN-HoaiMyNeural`  | Nữ        | Rõ, sáng                         |

Nghe thử các file trong `GiaoTrinh-GiaoAn-PP/tts-test/`. Giọng và tốc độ đặt ở đầu `script.json`:

```json
{ "voice": "vi-VN-NamMinhNeural", "rate": "-5%", "pitch": "+0Hz", "slides": [ ... ] }
```

`rate` âm là đọc chậm hơn (`-10%`), dương là nhanh hơn (`+10%`). Một slide có thể đặt riêng `"voice"` / `"rate"`.
Học sinh vẫn chỉnh được tốc độ phát 0.8× / 1× / 1.2× / 1.5× trên trang mà không cần tạo lại audio.

## 3. Viết / sửa lời giảng: `narration/script.json`

```json
{
  "slide": 5,
  "note": "05 · Activity 1 Q3 — chỉ để giáo viên đọc, không được đọc thành tiếng",
  "text": [
    "Vậy những mạng lưới đó có điểm gì chung?",
    "Các em hãy suy nghĩ và chọn đáp án. [pause:6]",
    "[step] Đáp án đúng là B và C."
  ]
}
```

- `slide`: số thứ tự slide (1, 2, 3… đúng như bộ đếm `05 / 22` trên slide).
- `text`: một chuỗi, hoặc một mảng các câu/đoạn (được nối lại, viết mảng cho dễ sửa).
- `[pause:6]`: dừng 6 giây cho học sinh suy nghĩ. Thanh điều khiển hiện "⏳ Các em suy nghĩ… 6s". Pause/Next vẫn dùng được trong lúc chờ.
- `[step]`: hiện **bước tiếp theo** trên slide, như khi giáo viên bấm → (hiện đáp án, hiện ý tiếp theo…).
  Số `[step]` nên bằng số phần tử `class="step"` của slide. Thừa thì bị bỏ qua, thiếu thì phần còn lại vẫn ẩn.
- Slide không có `text` (hoặc text rỗng) thì player báo "Slide này chưa có lời giảng", dừng 3 giây rồi đi tiếp.

Viết như giáo viên đang giảng: giải thích, đặt câu hỏi gợi mở, không đọc nguyên văn slide.
Mỗi slide khoảng 30–90 giây. Từ tiếng Anh/viết tắt dễ bị đọc sai, nên viết theo cách đọc (vd. "wifi").

## 4. Tạo audio

Chạy tại gốc repo website:

```sh
python scripts/generate-narration.py 6/4                # Tin học 6, Bài 4
```

- Chỉ tạo các đoạn **mới hoặc đã sửa**. Mỗi đoạn lưu mã băm của (lời, giọng, tốc độ); đoạn không đổi thì giữ nguyên file.
- File MP3 không còn dùng (do xoá lời) được dọn tự động.
- Edge TTS hay từ chối từng đợt vài phút (`NoAudioReceived`). Script tự chờ rồi thử lại (tối đa khoảng 6 phút mỗi đoạn).
  Bài 4 (59 đoạn) mất khoảng 30–40 phút cho lần tạo đầu tiên; các lần sau chỉ tạo đoạn đã sửa.
  Nếu vẫn lỗi, các đoạn đã tạo được giữ lại, chạy lại lệnh là làm tiếp.

Các tuỳ chọn khác:

```sh
python scripts/generate-narration.py 6/4 --slide 5          # tạo lại riêng slide 5
python scripts/generate-narration.py 6/4 --slide 3,7-9      # nhiều slide
python scripts/generate-narration.py 6/4 --force            # tạo lại toàn bộ
python scripts/generate-narration.py 6/4 --rate=-10%        # thử tốc độ khác (ghi đè script.json)
python scripts/generate-narration.py 6/4 --voice vi-VN-HoaiMyNeural
python scripts/generate-narration.py 6/4 --dry-run          # chỉ xem sẽ tạo những đoạn nào
```

Tên bài có thể ghi `6/4`, `6/Bai-04`, `tin6-bai4` hoặc đường dẫn tới thư mục bài.
Viết `Bai-4` không kèm lớp thì bị báo lỗi vì khớp cả lớp 6, 7, 8.

## 5. Thêm AI giảng cho một bài mới

1. Tạo khung lời giảng (mỗi slide một mục, `note` lấy từ comment/tiêu đề slide):
   ```sh
   python scripts/generate-narration.py 7/2 --init
   ```
2. Viết `text` cho từng slide trong `narration/script.json`.
3. Copy `narration.js` từ `Tin-Hoc-6/SlideHTML/Bai-04/` sang thư mục bài.
4. Thêm vào `index.html`, **ngay sau** dòng `<script src="slides.js"></script>`:
   ```html
   <script src="narration/narration-data.js"></script>
   <script src="narration.js"></script>
   ```
5. Tạo audio: `python scripts/generate-narration.py 7/2`

`narration.js` không cần sửa `slides.js`: nó theo dõi slide đang `.active` và điều khiển slide bằng phím ảo → / ←,
nên chạy được với mọi phiên bản `slides.js` hiện có. Xoá 2 dòng `<script>` là slide trở lại như cũ.

## 6. Thử trên máy

Mở thẳng file `index.html` của bài nguồn bằng Chrome/Edge (chạy được qua `file://`), hoặc sau khi publish:

```sh
python scripts/publish-slides.py
python -m http.server 8000      # mở http://localhost:8000/tin-hoc-6/bai-4/
```

Điều khiển:

| Nút / phím      | Tác dụng                                                     |
|-----------------|--------------------------------------------------------------|
| ▶ 🎙 AI giảng bài | Bắt đầu giảng **từ slide đang xem**                         |
| ⏸ / ▶ · phím **N** | Tạm dừng / tiếp tục (kể cả trong lúc đếm `[pause]`)        |
| ⏮ ⏭            | Slide trước / sau, rồi giảng slide đó                        |
| 🔊              | Âm lượng (ẩn trên màn hình hẹp)                              |
| 0.8× … 1.5×     | Tốc độ phát (lưu lại cho lần sau)                            |
| ✕               | Tắt AI giảng, slide vẫn dùng bình thường                     |

Trong lúc AI giảng, giáo viên vẫn bấm → ← như thường: audio cũ dừng, slide mới được giảng ngay.
Hết slide cuối thì dừng hẳn, hiện "✅ Đã giảng hết bài". Không quay về slide đầu.

Kiểm tra nhanh trong Console: `AINarration.state()`.

## 7. Deploy GitHub Pages

```sh
python scripts/publish-slides.py          # copy slide + narration.js + narration-data.js + MP3
git add tin-hoc-6/bai-4 && git commit -m "..." && git push
```

Mọi đường dẫn audio đều tương đối (`narration/audio/slide-01.mp3`), nên chạy được ở mọi URL con của GitHub Pages.
Dung lượng: khoảng 6 KB mỗi giây lời giảng (MP3 48 kbps mono), một bài 20 slide khoảng 4–6 MB.
