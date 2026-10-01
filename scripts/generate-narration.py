#!/usr/bin/env python3
"""Tạo file MP3 lời giảng ("AI giảng bài") cho một bài slide bằng Microsoft Edge TTS (miễn phí, không cần API key).

Chạy trên máy giáo viên, TRƯỚC khi publish. Website chỉ phát các file MP3 tĩnh đã tạo sẵn.

Trong thư mục bài nguồn (<source>/Tin-Hoc-N/SlideHTML/Bai-XX/):
    narration/script.json          lời giảng — giáo viên sửa file này
    narration/narration-data.js    TỰ SINH: danh sách đoạn audio/khoảng dừng cho player (đừng sửa tay)
    narration/audio/slide-01.mp3   TỰ SINH: audio từng slide (slide-01-2.mp3, … nếu slide có [pause]/[step])
    narration/.cache.json          TỰ SINH: mã băm từng đoạn, để chỉ tạo lại đoạn đã sửa

Trong lời giảng có thể chèn:
    [pause:5]   dừng 5 giây cho học sinh suy nghĩ (player tự đếm, có thể Pause/Next)
    [step]      hiện bước tiếp theo trên slide (như bấm → một lần), rồi giảng tiếp

Cách dùng (chạy tại gốc repo website):
    python scripts/generate-narration.py 6/4                 # Tin học 6, Bài 4 — chỉ tạo đoạn mới/đã sửa
    python scripts/generate-narration.py 6/4 --slide 5       # tạo lại riêng slide 5 (kể cả khi chưa sửa)
    python scripts/generate-narration.py 6/4 --slide 3,7-9
    python scripts/generate-narration.py 6/4 --force         # tạo lại toàn bộ
    python scripts/generate-narration.py 6/4 --voice vi-VN-HoaiMyNeural --rate=-10%
    python scripts/generate-narration.py 6/4 --dry-run       # chỉ liệt kê việc sẽ làm
    python scripts/generate-narration.py 6/4 --init          # tạo script.json khung cho bài mới
    python scripts/generate-narration.py --list-voices
Bài có thể ghi: 6/4, 6/Bai-04, tin6-bai4, Tin-Hoc-6/Bai-04 hoặc đường dẫn tới thư mục bài.
"""

import argparse
import asyncio
import hashlib
import html
import json
import re
import sys
from pathlib import Path

try:
    import edge_tts
except ImportError:  # báo rõ ràng thay vì traceback
    edge_tts = None

REPO = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = REPO.parent / "GiaoTrinh-GiaoAn-PP"
DEFAULT_VOICE = "vi-VN-NamMinhNeural"
DEFAULT_RATE = "-5%"
DEFAULT_PITCH = "+0Hz"
DATA_FILE = "narration-data.js"
DATA_VAR = "window.NARRATION_DATA"
CACHE_FILE = ".cache.json"  # không publish
MARK = re.compile(r"\[\s*(pause|step)\s*(?::\s*(\d+(?:\.\d+)?)\s*)?\]", re.I)
RETRY_WAIT = (5, 10, 20, 30, 60, 60, 90, 120)  # Edge TTS hay lỗi từng đợt ngắn (NoAudioReceived) — chờ rồi thử lại


def fail(msg):
    print(f"LỖI: {msg}", file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------- tìm thư mục bài
def resolve_lesson(arg, source):
    p = Path(arg)
    if p.is_dir() and (p / "index.html").exists():
        return p.resolve()
    nums = [int(n) for n in re.findall(r"\d+", arg)]
    grades = [nums[0]] if len(nums) >= 2 else [6, 7, 8, 9]
    lesson = nums[-1] if nums else None
    if lesson is None:
        fail(f"không hiểu tên bài '{arg}'. Ví dụ: 6/4 (Tin học 6, Bài 4) hoặc đường dẫn tới thư mục bài.")
    found = [source / f"Tin-Hoc-{g}" / "SlideHTML" / f"Bai-{lesson:02d}" for g in grades]
    found = [d for d in found if (d / "index.html").exists()]
    if not found:
        fail(f"không tìm thấy bài '{arg}' trong {source} (cần .../Tin-Hoc-N/SlideHTML/Bai-XX/index.html).")
    if len(found) > 1:
        fail(f"'{arg}' khớp nhiều bài — ghi rõ lớp, ví dụ 6/{lesson}:\n  " + "\n  ".join(map(str, found)))
    return found[0]


def slide_titles(index_html):
    """Tiêu đề ngắn của từng <section class="slide"> (để tạo script khung và kiểm tra số slide)."""
    out = []
    for m in re.finditer(r'(?:<!--\s*((?:(?!-->).)*?)\s*-->\s*)?<section[^>]*class="slide[ "][^>]*>(.*?)</section>', index_html, re.S):
        comment, body = m.group(1), m.group(2)
        h = re.search(r"<h[12][^>]*>(.*?)</h[12]>", body, re.S)
        title = comment or (h and h.group(1)) or ""
        out.append(re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", title))).strip())
    return out


# ---------------------------------------------------------------- script → các đoạn
def slide_text(entry):
    t = entry.get("text", "")
    if isinstance(t, list):
        t = " ".join(str(x) for x in t)
    return re.sub(r"\s+", " ", str(t)).strip()


def split_items(text):
    """'A [pause:3] B [step] C' → [('say','A'), ('pause',3), ('say','B'), ('step',None), ('say','C')]"""
    items, pos = [], 0
    for m in MARK.finditer(text):
        say = text[pos:m.start()].strip()
        if say:
            items.append(("say", say))
        if m.group(1).lower() == "pause":
            items.append(("pause", float(m.group(2) or 3)))
        else:
            items.append(("step", None))
        pos = m.end()
    tail = text[pos:].strip()
    if tail:
        items.append(("say", tail))
    return items


def clip_name(slide, k):
    return f"slide-{slide:02d}.mp3" if k == 1 else f"slide-{slide:02d}-{k}.mp3"


def clip_hash(text, voice, rate, pitch):
    return hashlib.sha1(json.dumps([text, voice, rate, pitch], ensure_ascii=False).encode()).hexdigest()[:12]


def parse_slide_selection(spec):
    sel = set()
    for part in spec.split(","):
        part = part.strip()
        if re.fullmatch(r"\d+", part):
            sel.add(int(part))
        elif re.fullmatch(r"\d+\s*-\s*\d+", part):
            a, b = map(int, part.split("-"))
            sel.update(range(min(a, b), max(a, b) + 1))
        elif part:
            fail(f"--slide '{spec}' không hợp lệ. Ví dụ: --slide 5 hoặc --slide 3,7-9")
    return sel


def load_old_data(path):
    if not path.exists():
        return {}
    s = path.read_text(encoding="utf-8")
    try:
        return json.loads(s[s.index("{"): s.rindex("}") + 1])
    except ValueError:
        print(f"  ! không đọc được {path.name} cũ — sẽ tạo lại từ đầu")
        return {}


# ---------------------------------------------------------------- Edge TTS
async def tts(text, voice, rate, pitch, out):
    tmp = out.with_suffix(".part")
    last = None
    for wait in (0,) + RETRY_WAIT:
        if wait:
            print(f"      … Edge TTS chưa trả audio ({last}), thử lại sau {wait}s", flush=True)
            await asyncio.sleep(wait)
        try:
            await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(str(tmp))
            if tmp.stat().st_size < 1000:
                raise RuntimeError("file audio rỗng")
            tmp.replace(out)
            return
        except ValueError as e:  # sai voice/rate/pitch — thử lại cũng vô ích
            tmp.unlink(missing_ok=True)
            fail(f"tham số không hợp lệ ({e}). Kiểm tra voice='{voice}', rate='{rate}', pitch='{pitch}'.")
        except Exception as e:  # NoAudioReceived, lỗi mạng, …
            last = type(e).__name__
            tmp.unlink(missing_ok=True)
    raise RuntimeError(f"Edge TTS lỗi liên tục ({last}). Kiểm tra mạng rồi chạy lại — các đoạn đã tạo được giữ nguyên.")


async def list_voices():
    for v in sorted(await edge_tts.list_voices(), key=lambda v: v["ShortName"]):
        if v["Locale"].startswith("vi-"):
            print(f"{v['ShortName']:28} {v['Gender']:7} {', '.join(v.get('VoiceTag', {}).get('VoicePersonalities', []))}")


# ---------------------------------------------------------------- main
def init_script(lesson, script_path):
    if script_path.exists():
        fail(f"{script_path} đã có — không ghi đè.")
    titles = slide_titles((lesson / "index.html").read_text(encoding="utf-8"))
    data = {
        "voice": DEFAULT_VOICE, "rate": DEFAULT_RATE, "pitch": DEFAULT_PITCH,
        "slides": [{"slide": i, "note": t, "text": ""} for i, t in enumerate(titles, 1)],
    }
    script_path.parent.mkdir(parents=True, exist_ok=True)
    script_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Đã tạo {script_path} với {len(titles)} slide (text rỗng). Viết lời giảng rồi chạy lại không có --init.")


async def run(args):
    lesson = resolve_lesson(args.lesson, args.source)
    ndir = lesson / "narration"
    script_path = ndir / "script.json"
    if args.init:
        return init_script(lesson, script_path)
    if not script_path.exists():
        fail(f"chưa có {script_path}. Tạo khung bằng: python scripts/generate-narration.py {args.lesson} --init")
    try:
        script = json.loads(script_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        fail(f"{script_path.name} sai cú pháp JSON ở dòng {e.lineno}, cột {e.colno}: {e.msg}")

    voice = args.voice or script.get("voice") or DEFAULT_VOICE
    rate = args.rate or script.get("rate") or DEFAULT_RATE
    pitch = script.get("pitch") or DEFAULT_PITCH
    n_slides = len(slide_titles((lesson / "index.html").read_text(encoding="utf-8")))
    only = parse_slide_selection(args.slide) if args.slide else None

    audio_dir = ndir / "audio"
    data_path = ndir / DATA_FILE
    cache_path = ndir / CACHE_FILE
    old = load_old_data(data_path).get("slides", {})
    # tên file → mã băm của đoạn đã tạo; ghi ngay sau mỗi đoạn để chạy lại sau khi bị ngắt không phải tạo lại
    try:
        cache = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
    except ValueError:
        cache = {}
    for its in old.values():  # dữ liệu cũ cũng ghi mã băm từng đoạn
        for it in its:
            if "audio" in it and "hash" in it:
                cache.setdefault(it["audio"].split("/")[-1], it["hash"])
    print(f"Bài:   {lesson}\nVoice: {voice} · rate {rate} · pitch {pitch} · {n_slides} slide trên trang"
          f"{'  (DRY RUN)' if args.dry_run else ''}\n")

    seen, slides_out, todo = set(), {}, []
    for entry in script.get("slides", []):
        num = entry.get("slide")
        if not isinstance(num, int) or num < 1:
            fail(f"mỗi mục trong 'slides' cần \"slide\": số nguyên ≥ 1 (gặp: {entry!r:.80})")
        if num in seen:
            fail(f"slide {num} xuất hiện hai lần trong script.json")
        seen.add(num)
        if num > n_slides:
            print(f"  ! slide {num}: trang chỉ có {n_slides} slide — vẫn tạo audio nhưng sẽ không bao giờ được phát")
        text = slide_text(entry)
        if not text:
            continue
        if only is not None and num not in only:  # giữ nguyên slide không được chọn
            if str(num) in old:
                slides_out[str(num)] = old[str(num)]
            continue
        v = entry.get("voice") or voice
        r = entry.get("rate") or rate
        items, k = [], 0
        for kind, val in split_items(text):
            if kind == "pause":
                items.append({"pause": val})
            elif kind == "step":
                items.append({"step": 1})
            else:
                k += 1
                name = clip_name(num, k)
                h = clip_hash(val, v, r, pitch)
                items.append({"audio": f"narration/audio/{name}", "hash": h})
                fresh = (audio_dir / name).exists() and cache.get(name) == h
                if args.force or only is not None or not fresh:
                    todo.append((num, name, val, v, r))
        if not any("audio" in it for it in items):
            print(f"  ! slide {num}: chỉ có [pause]/[step], không có lời — bỏ qua")
            continue
        slides_out[str(num)] = items

    missing = [n for n in range(1, n_slides + 1) if str(n) not in slides_out]
    if missing:
        print(f"  · chưa có lời giảng: slide {', '.join(map(str, missing))} (player sẽ báo và bỏ qua)")
    if only is not None and not (only & seen):
        fail(f"--slide {args.slide}: không có slide nào như vậy trong script.json")

    print(f"\nCần tạo {len(todo)} đoạn audio, giữ nguyên {sum(1 for s in slides_out.values() for it in s if 'audio' in it) - len(todo)} đoạn.")
    if args.dry_run:
        for num, name, text, *_ in todo:
            print(f"  - {name}: {text[:70]}{'…' if len(text) > 70 else ''}")
        return

    audio_dir.mkdir(parents=True, exist_ok=True)
    sem = asyncio.Semaphore(args.jobs)
    done = 0

    async def job(num, name, text, v, r):
        nonlocal done
        async with sem:
            await tts(text, v, r, pitch, audio_dir / name)
            cache[name] = clip_hash(text, v, r, pitch)
            cache_path.write_text(json.dumps(cache, indent=1, sort_keys=True), encoding="utf-8")
            done += 1
            print(f"  ✓ [{done}/{len(todo)}] {name}", flush=True)

    error = None
    try:
        await asyncio.gather(*(job(*t) for t in todo))
    except RuntimeError as e:
        error = e
    if error:
        # chỉ ghi vào dữ liệu các đoạn thật sự có file, để player không trỏ tới file hỏng/thiếu
        bad = {name for _, name, *_ in todo if not (audio_dir / name).exists()}
        ok_old = {k: v for k, v in old.items()}
        for num, items in list(slides_out.items()):
            if any(it.get("audio", "").split("/")[-1] in bad for it in items):
                if num in ok_old:
                    slides_out[num] = ok_old[num]
                else:
                    del slides_out[num]

    used = {it["audio"].split("/")[-1] for s in slides_out.values() for it in s if "audio" in it}
    if error is None and only is None:  # dọn file audio không còn dùng (chỉ khi chạy đủ cả bài)
        for f in sorted(audio_dir.glob("slide-*.mp3")):
            if f.name not in used:
                f.unlink()
                cache.pop(f.name, None)
                print(f"  − xoá {f.name} (không còn dùng)")

    if not args.dry_run:
        cache_path.write_text(json.dumps(cache, indent=1, sort_keys=True), encoding="utf-8")
    payload = {"version": 1, "voice": voice, "rate": rate,
               "slides": dict(sorted(slides_out.items(), key=lambda kv: int(kv[0])))}
    data_path.write_text(
        "/* TỰ SINH bởi scripts/generate-narration.py — đừng sửa tay.\n"
        "   Sửa lời giảng trong narration/script.json rồi chạy lại script. */\n"
        f"{DATA_VAR} = {json.dumps(payload, ensure_ascii=False, indent=1)};\n",
        encoding="utf-8", newline="\n")
    print(f"\nĐã ghi {data_path.relative_to(lesson)} ({len(slides_out)} slide có lời giảng).")
    if error:
        fail(str(error))


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("lesson", nargs="?", help="bài cần tạo audio, ví dụ 6/4 hoặc đường dẫn thư mục bài")
    ap.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="thư mục GiaoTrinh-GiaoAn-PP")
    ap.add_argument("--slide", help="chỉ tạo lại các slide này, ví dụ 5 hoặc 3,7-9")
    ap.add_argument("--voice", help=f"giọng đọc (mặc định lấy trong script.json, rồi tới {DEFAULT_VOICE})")
    ap.add_argument("--rate", help=f"tốc độ nói, viết liền dấu =, ví dụ --rate=-10%% (mặc định {DEFAULT_RATE.replace('%', '%%')})")
    ap.add_argument("--force", action="store_true", help="tạo lại mọi đoạn, kể cả khi không đổi")
    ap.add_argument("--dry-run", action="store_true", help="chỉ in ra việc sẽ làm")
    ap.add_argument("--jobs", type=int, default=3, help="số đoạn tạo song song (mặc định 3)")
    ap.add_argument("--init", action="store_true", help="tạo narration/script.json khung cho bài chưa có lời giảng")
    ap.add_argument("--list-voices", action="store_true", help="liệt kê giọng tiếng Việt của Edge TTS")
    args = ap.parse_args()
    if args.rate and not re.fullmatch(r"[+-]\d+%", args.rate):
        fail(f"--rate '{args.rate}' không hợp lệ. Ví dụ: --rate=-10%  --rate=+0%  --rate=+15%")
    needs_tts = args.list_voices or not (args.init or args.dry_run)
    if needs_tts and edge_tts is None:
        fail("chưa cài edge-tts. Chạy: python -m pip install edge-tts")
    if args.list_voices:
        return asyncio.run(list_voices())
    if not args.lesson:
        ap.error("cần tên bài, ví dụ: python scripts/generate-narration.py 6/4")
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
