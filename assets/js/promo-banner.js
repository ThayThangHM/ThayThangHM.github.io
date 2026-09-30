// Banner "Đăng ký học lập trình" — dùng chung cho MỌI trang (trang chủ, mục lục, slide).
// Tự chứa: tự chèn CSS + HTML, không phụ thuộc style.css, nên slide độc lập cũng dùng được.
// Gắn vào trang bằng một dòng <script> trước </body> (scripts/publish-slides.py tự thêm).
// Đổi nội dung / link: sửa các hằng bên dưới — chỉ một chỗ này.
(function () {
  'use strict';

  var FORM_URL = 'https://forms.gle/E9iDj8NYPNnYDgff6';
  var TITLE = 'Đăng ký học lập trình';
  var TITLE_MORE = ' cùng Thầy Thắng';      // ẩn ở bản gọn (điện thoại, trang slide)
  var SUB = 'Học bài bản • Thực hành thực tế • Phát triển tư duy lập trình';
  var CTA = 'Đăng ký ngay';
  var STORE_KEY = 'ttPromoClosed';   // sessionStorage: đóng rồi thì không hiện lại trong phiên/tab này

  function closed() {
    try { return sessionStorage.getItem(STORE_KEY) === '1'; } catch (e) { return false; }
  }
  if (closed() || document.querySelector('.tt-promo')) return;

  var CSS = [
    '.tt-promo{position:fixed;right:20px;bottom:20px;z-index:1000;width:360px;max-width:calc(100vw - 40px);',
    '  box-sizing:border-box;border-radius:18px;color:#fff;text-align:left;',
    '  font:400 16px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;',
    '  background:radial-gradient(70% 90% at 100% 0%,rgba(236,72,153,.38),transparent 60%),',
    '    linear-gradient(135deg,#0b1220 0%,#1e1b4b 55%,#3b0764 100%);',
    '  border:1px solid rgba(255,255,255,.16);box-shadow:0 14px 36px rgba(15,23,42,.35);',
    '  opacity:0;transform:translateY(16px);transition:opacity .35s ease,transform .35s ease}',
    '.tt-promo *{box-sizing:border-box}',
    '.tt-promo.is-in{opacity:1;transform:none}',
    '.tt-promo-link{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;align-items:center;',
    '  padding:16px 44px 16px 16px;color:inherit;text-decoration:none;border-radius:inherit}',
    '.tt-promo-icon{grid-row:span 2;align-self:start;display:grid;place-items:center;width:44px;height:44px;',
    '  border-radius:12px;background:rgba(255,255,255,.12);font-size:24px;line-height:1}',
    '.tt-promo-title{font-size:16px;font-weight:800;line-height:1.25;letter-spacing:.02em;text-transform:uppercase}',
    '.tt-promo-sub{font-size:13.5px;color:#c7d2fe}',
    '.tt-promo-cta{grid-column:1 / -1;justify-self:start;margin-top:8px;padding:10px 20px;border-radius:10px;',
    '  background:#fbbf24;color:#1e1b4b;font-size:15px;font-weight:800;letter-spacing:.03em;',
    '  text-transform:uppercase;white-space:nowrap;transition:background-color .15s ease,transform .15s ease}',
    '.tt-promo-link:hover .tt-promo-cta{background:#fcd34d;transform:translateY(-1px)}',
    '.tt-promo-close{position:absolute;top:6px;right:6px;width:32px;height:32px;padding:0;border:0;border-radius:50%;',
    '  background:rgba(255,255,255,.12);color:#fff;font:400 22px/1 Arial,sans-serif;cursor:pointer}',
    '.tt-promo-close:hover{background:rgba(255,255,255,.26)}',
    '.tt-promo-link:focus-visible,.tt-promo-close:focus-visible{outline:3px solid #f59e0b;outline-offset:2px}',

    /* Gọn một hàng: điện thoại (sát đáy) và trang slide (không che nội dung bài) */
    '.tt-promo--slide{width:auto;max-width:min(420px,calc(100vw - 24px));border-radius:14px}',
    '.tt-promo--slide .tt-promo-link{grid-template-columns:auto 1fr auto;padding:8px 46px 8px 10px;gap:0 10px}',
    '.tt-promo--slide .tt-promo-icon{grid-row:auto;align-self:center;width:32px;height:32px;font-size:18px;border-radius:9px}',
    '.tt-promo--slide .tt-promo-title{font-size:13px}',
    '.tt-promo--slide .tt-promo-sub,.tt-promo--slide .tt-promo-more{display:none}',
    '.tt-promo--slide .tt-promo-cta{grid-column:auto;margin:0;padding:10px 14px;font-size:13px}',
    '.tt-promo--slide .tt-promo-close{top:50%;margin-top:-16px}',
    '@media (max-width:600px){',
    '  .tt-promo{left:8px;right:8px;bottom:8px;width:auto;max-width:none;border-radius:14px}',
    '  .tt-promo-link{grid-template-columns:1fr auto;padding:10px 46px 10px 12px;gap:0 10px}',
    '  .tt-promo-icon,.tt-promo-sub,.tt-promo-more{display:none}',
    '  .tt-promo-title{font-size:13.5px}',
    '  .tt-promo-cta{grid-column:auto;margin:0;padding:12px 14px;font-size:13.5px}',
    '  .tt-promo-close{top:50%;margin-top:-16px}',
    '  .tt-promo--slide{max-width:none}',
    '  .tt-promo--slide .tt-promo-link{grid-template-columns:1fr auto}',
    '  .tt-promo--slide .tt-promo-cta{padding:12px 14px}',
    '}',
    '@media (prefers-reduced-motion:reduce){.tt-promo,.tt-promo-cta{transition:none}.tt-promo{transform:none}}',
    '@media print{.tt-promo{display:none}}'
  ].join('\n');

  function init() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var box = document.createElement('aside');
    box.className = 'tt-promo';
    box.lang = 'vi';
    box.setAttribute('aria-label', 'Đăng ký học lập trình');
    box.innerHTML =
      '<a class="tt-promo-link" href="' + FORM_URL + '" target="_blank" rel="noopener noreferrer">' +
        '<span class="tt-promo-icon" aria-hidden="true">🚀</span>' +
        '<span class="tt-promo-title"><span class="tt-promo-main"></span><span class="tt-promo-more"></span></span>' +
        '<span class="tt-promo-sub"></span>' +
        '<span class="tt-promo-cta"></span>' +
        '<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)"> (mở form đăng ký trong tab mới)</span>' +
      '</a>' +
      '<button class="tt-promo-close" type="button" aria-label="Đóng banner đăng ký">&times;</button>';
    box.querySelector('.tt-promo-main').textContent = TITLE;
    box.querySelector('.tt-promo-more').textContent = TITLE_MORE;
    box.querySelector('.tt-promo-sub').textContent = SUB;
    box.querySelector('.tt-promo-cta').textContent = CTA;

    box.querySelector('.tt-promo-close').addEventListener('click', function () {
      try { sessionStorage.setItem(STORE_KEY, '1'); } catch (e) { /* chế độ riêng tư: chỉ ẩn */ }
      window.removeEventListener('resize', place);
      box.remove();
    });

    // Trang slide bắt Enter/Space ở document để chuyển slide — không để phím bấm trên banner lọt xuống.
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') e.stopPropagation();
    });

    // Trang slide (có #stage 16:9 tự co giãn): dùng bản gọn, đặt ngay TRÊN thanh điều hướng
    // (#hud / #bar) để không che nút chuyển slide, số trang. Nếu dưới sân khấu còn khoảng trống
    // (màn hình dọc) thì banner nằm ở đó, không đè lên slide.
    var stage = document.getElementById('stage');
    var bar = stage && stage.querySelector('#hud, #bar');
    function place() {
      if (!stage) return;
      var vw = window.innerWidth, vh = window.innerHeight;
      var s = stage.getBoundingClientRect();
      if (vh - s.bottom >= box.offsetHeight + 16) {
        box.style.bottom = box.style.right = '';
        return;
      }
      var top = bar ? bar.getBoundingClientRect().top : s.bottom;
      box.style.bottom = Math.max(8, vh - top + 8) + 'px';
      if (vw > 600) box.style.right = Math.max(12, vw - s.right + 12) + 'px';
      else box.style.right = '';
    }
    if (stage) {
      box.classList.add('tt-promo--slide');
      window.addEventListener('resize', place);
    }

    document.body.appendChild(box);
    place();
    setTimeout(function () { place(); box.classList.add('is-in'); }, 600);
  }

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);
})();
