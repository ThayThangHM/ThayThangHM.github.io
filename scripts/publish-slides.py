#!/usr/bin/env python3
"""Đồng bộ slide HTML từ project nguồn sang website (không commit, không push).

Nguồn:   <source>/Tin-Hoc-{6,7,8}/SlideHTML/Bai-XX/
Đích:    <repo>/tin-hoc-{6,7,8}/bai-X/

Mỗi bài được copy nguyên bản: index.html, các file .css/.js cùng cấp, thư mục assets/ và lời giảng
"AI giảng bài" nếu có (narration/narration-data.js + narration/audio/*.mp3 — xem docs/AI-NARRATION.md).
Các file khác trong thư mục bài (ghi chú, bản nháp…) KHÔNG được copy, chỉ cảnh báo.
Trước khi copy, script kiểm tra mọi đường dẫn trong HTML/CSS/JS:
  - không có đường dẫn tuyệt đối/local (D:\\..., file:///, /...);
  - không có URL Internet (http://, https://, //cdn...);
  - mọi file được tham chiếu đều tồn tại và nằm trong thư mục bài.
Bài không đạt sẽ bị bỏ qua (không copy).

Sau đó danh sách bài trong tin-hoc-X/index.html (giữa hai dòng đánh dấu
<!-- LESSONS:BEGIN --> và <!-- LESSONS:END -->) được tạo lại.

Cuối cùng, mọi trang .html trong repo được gắn banner đăng ký dùng chung
(assets/js/promo-banner.js) bằng một dòng <script> trước </body> — trang nào có rồi thì giữ nguyên.
Slide copy nguyên bản từ nguồn nên không có dòng này; script thêm lại sau mỗi lần đồng bộ.

Cách dùng (chạy tại gốc repo website):
    python scripts/publish-slides.py --dry-run     # xem trước, không ghi gì
    python scripts/publish-slides.py               # đồng bộ thật
    python scripts/publish-slides.py --source "D:/duong/dan/GiaoTrinh-GiaoAn-PP"
    python scripts/publish-slides.py --banner-only # chỉ gắn banner vào các trang, không đồng bộ slide
"""

import argparse
import html
import os
import re
import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = REPO.parent / "GiaoTrinh-GiaoAn-PP"
GRADES = (6, 7, 8)
LESSON_DIR = re.compile(r"^Bai-(\d+)$")
# Bài không đưa lên website (vẫn giữ trong nguồn). 0 = Bài mở đầu (Bai-00).
EXCLUDE = {0}
BEGIN, END = "<!-- LESSONS:BEGIN -->", "<!-- LESSONS:END -->"
# Banner đăng ký dùng chung cho mọi trang (nội dung, link, giao diện nằm trong file này)
BANNER_JS = "assets/js/promo-banner.js"

REF = re.compile(
    r"""(?:src|href|poster|data-src)\s*=\s*["']([^"']+)["']"""
    r"""|url\(\s*["']?([^"')]+)["']?\s*\)"""
    r"""|(?:fetch|import)\s*\(\s*["']([^"']+)["']"""
    r"""|@import\s+["']([^"']+)["']""",
    re.I,
)
SKIP_REF = ("#", "data:", "javascript:", "mailto:", "tel:", "blob:")


def text(fragment):
    """HTML → chữ thuần, gọn khoảng trắng."""
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def has_vietnamese(s):
    return any(ord(c) > 127 and c.isalpha() for c in s)


def lesson_info(index_html, num):
    """Lấy tên bài tiếng Việt và tên tiếng Anh (nếu có) từ chính slide.

    Ưu tiên phần đầu <title> nếu là tiếng Việt; nếu không, lấy "Bài N — ..." hoặc
    "Bài mở đầu — ..." trên slide bìa. Không xác định được thì để trống (chỉ hiện "Bài N").
    """
    s = index_html
    title = re.search(r"<title>(.*?)</title>", s, re.S)
    title = text(title.group(1)).split(" · ")[0].strip() if title else ""
    h1 = re.search(r"<h1[^>]*>(.*?)</h1>", s, re.S)
    h1 = text(h1.group(1)) if h1 else ""
    cover = re.search(r"<section[^>]*\bslide\b[^>]*>(.*?)</section>", s, re.S)
    cover = cover.group(1) if cover else ""

    vi = ""
    if title and has_vietnamese(title):
        vi = title
    else:
        # Dòng "Bài N — Tên bài" nằm gọn trong một thẻ trên slide bìa
        m = re.search(r">\s*Bài (?:mở đầu|\d+)\s*[—–-]\s*([^<]+?)\s*<", cover)
        # dòng bìa ghi rõ "Bài N — …" nên tin được cả khi tên không dấu (vd "Internet")
        if m:
            vi = text(m.group(1))
    en = h1 if h1 and not has_vietnamese(h1) else ""
    label = "Bài mở đầu" if num == 0 and "Bài mở đầu" in cover else f"Bài {num}"
    return {"label": label, "vi": vi, "en": en}


def check_refs(lesson_dir):
    """Trả về danh sách lỗi đường dẫn (rỗng nếu ổn)."""
    errors = []
    root = lesson_dir.resolve()
    for f in lesson_dir.rglob("*"):
        if f.suffix.lower() not in (".html", ".css", ".js"):
            continue
        for m in REF.finditer(f.read_text(encoding="utf-8", errors="replace")):
            ref = next(g for g in m.groups() if g)
            if ref.startswith(SKIP_REF) or "${" in ref or "+" in ref:
                continue
            where = f"{f.relative_to(lesson_dir)}: {ref}"
            if re.match(r"(https?:)?//", ref):
                errors.append("URL Internet — " + where)
            elif re.match(r"[A-Za-z]:[\\/]|file:|/", ref):
                errors.append("đường dẫn tuyệt đối/local — " + where)
            else:
                target = (f.parent / ref.split("?")[0].split("#")[0]).resolve()
                if root not in target.parents and target != root:
                    errors.append("nằm ngoài thư mục bài — " + where)
                elif not target.exists():
                    errors.append("thiếu file — " + where)
    return errors


def files_to_publish(lesson_dir):
    """index.html + .css/.js cùng cấp + toàn bộ assets/ + audio lời giảng. Trả về (danh sách copy, danh sách bỏ qua)."""
    keep, skipped = [], []
    for f in lesson_dir.rglob("*"):
        if f.is_dir():
            continue
        rel = f.relative_to(lesson_dir)
        top_level_code = len(rel.parts) == 1 and (rel.name == "index.html" or rel.suffix in (".css", ".js"))
        in_assets = rel.parts[0] == "assets" and not rel.name.startswith(".")
        # narration/script.json chỉ dùng để tạo audio trên máy giáo viên, website không cần
        narration = rel.parts[0] == "narration" and (
            rel.as_posix() == "narration/narration-data.js"
            or (len(rel.parts) == 3 and rel.parts[1] == "audio" and rel.suffix == ".mp3"))
        if rel.parts[0] == "narration" and not narration:
            continue
        (keep if top_level_code or in_assets or narration else skipped).append(rel)
    return keep, skipped


def render_cards(grade, lessons):
    out = []
    for num, info in lessons:
        title = html.escape(info["vi"] or info["label"])
        lines = [
            f'            <li class="card lesson">',
            f'              <a class="card-body" href="bai-{num}/">',
            f'                <span class="lesson-label">{html.escape(info["label"])}</span>',
            f'                <h2 class="card-title">{title}</h2>',
        ]
        if info["en"]:
            lines.append(f'                <p class="lesson-en" lang="en">{html.escape(info["en"])}</p>')
        lines += [
            f'                <span class="card-cta">Mở bài giảng</span>',
            f'              </a>',
            f'            </li>',
        ]
        out.append("\n".join(lines))
    return "\n\n".join(out)


def update_index(grade, lessons, dry):
    page = REPO / f"tin-hoc-{grade}" / "index.html"
    if not page.exists():
        print(f"  ! chưa có {page.relative_to(REPO)} — bỏ qua bước cập nhật danh sách")
        return
    s = page.read_text(encoding="utf-8")
    if BEGIN not in s or END not in s:
        print(f"  ! {page.relative_to(REPO)} thiếu dấu {BEGIN} / {END} — không sửa")
        return
    head, rest = s.split(BEGIN, 1)
    _, tail = rest.split(END, 1)
    new = f"{head}{BEGIN}\n{render_cards(grade, lessons)}\n            {END}{tail}"
    if new != s and not dry:
        page.write_text(new, encoding="utf-8", newline="\n")
    print(f"  danh sách bài trong {page.relative_to(REPO)}: {'giữ nguyên' if new == s else 'cập nhật'}")


def ensure_banner(dry):
    """Gắn <script> banner dùng chung vào mọi trang .html trong repo (bỏ qua trang đã có)."""
    added = 0
    for page in sorted(REPO.rglob("*.html")):
        rel = page.relative_to(REPO)
        if rel.parts[0].startswith("."):
            continue
        with open(page, encoding="utf-8", newline="") as f:
            s = f.read()
        if Path(BANNER_JS).name in s:
            continue
        i = s.lower().rfind("</body>")
        if i < 0:
            print(f"  ! {rel.as_posix()}: không có </body> — không gắn được banner")
            continue
        src = "../" * (len(rel.parts) - 1) + BANNER_JS
        nl = "\r\n" if "\r\n" in s else "\n"
        if not dry:
            with open(page, "w", encoding="utf-8", newline="") as f:
                f.write(f'{s[:i]}<script src="{src}" defer></script>{nl}{s[i:]}')
        print(f"  + {rel.as_posix()}")
        added += 1
    print(f"Banner đăng ký ({BANNER_JS}): {f'gắn thêm vào {added} trang' if added else 'mọi trang đã có'}\n")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="thư mục GiaoTrinh-GiaoAn-PP")
    ap.add_argument("--dry-run", action="store_true", help="chỉ in ra, không ghi file")
    ap.add_argument("--banner-only", action="store_true", help="chỉ gắn banner đăng ký vào các trang, không đồng bộ slide")
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")

    if args.banner_only:
        ensure_banner(args.dry_run)
        return

    if not args.source.is_dir():
        sys.exit(f"Không tìm thấy thư mục nguồn: {args.source}")
    print(f"Nguồn: {args.source}\nĐích:  {REPO}{'  (DRY RUN)' if args.dry_run else ''}\n")

    problems = 0
    for grade in GRADES:
        src_root = args.source / f"Tin-Hoc-{grade}" / "SlideHTML"
        dst_root = REPO / f"tin-hoc-{grade}"
        print(f"== Tin học {grade}")
        if not src_root.is_dir():
            print(f"  ! không có {src_root}")
            continue
        lessons = []
        for d in sorted(src_root.iterdir(), key=lambda p: p.name):
            m = LESSON_DIR.match(d.name)
            if not d.is_dir() or not m:
                continue
            num = int(m.group(1))
            if num in EXCLUDE:
                print(f"  – {d.name}: bỏ qua (nằm trong EXCLUDE)")
                continue
            if not (d / "index.html").exists():
                print(f"  ! {d.name}: không có index.html — bỏ qua")
                problems += 1
                continue
            errors = check_refs(d)
            if errors:
                problems += 1
                print(f"  ✗ {d.name}: KHÔNG publish vì:")
                for e in errors:
                    print(f"      - {e}")
                continue
            keep, skipped = files_to_publish(d)
            info = lesson_info((d / "index.html").read_text(encoding="utf-8"), num)
            dst = dst_root / f"bai-{num}"
            print(f"  ✓ {d.name} → {dst.relative_to(REPO).as_posix()}/  ({len(keep)} file)  "
                  f"{info['label']}: {info['vi'] or '(không xác định được tên — chỉ ghi số bài)'}")
            for rel in skipped:
                print(f"      · không copy (không phải file slide): {rel.as_posix()}")
            if not args.dry_run:
                if dst.exists():
                    shutil.rmtree(dst)
                for rel in keep:
                    (dst / rel).parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(d / rel, dst / rel)
            lessons.append((num, info))

        published = {n for n, _ in lessons}
        if dst_root.is_dir():
            for extra in sorted(dst_root.glob("bai-*")):
                n = extra.name[4:]
                if extra.is_dir() and n.isdigit() and int(n) in EXCLUDE:
                    print(f"  ! {extra.relative_to(REPO).as_posix()}/ nằm trong EXCLUDE nhưng vẫn còn trên website — hãy tự xoá")
                elif extra.is_dir() and n.isdigit() and int(n) not in published:
                    print(f"  ! {extra.relative_to(REPO).as_posix()}/ không còn trong nguồn — giữ nguyên, hãy tự xoá nếu muốn")
        update_index(grade, sorted(lessons), args.dry_run)
        print()

    ensure_banner(args.dry_run)
    print("Xong." if not problems else f"Xong, có {problems} bài cần xem lại.")
    print("Script không commit/push. Kiểm tra bằng: python -m http.server 8000")


if __name__ == "__main__":
    main()
