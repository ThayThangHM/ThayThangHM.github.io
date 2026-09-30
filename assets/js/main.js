// Menu gập cho màn hình hẹp. Không có JS thì menu vẫn hiển thị đầy đủ (cuộn ngang).
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;

  function setOpen(open) {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  }

  toggle.addEventListener('click', function () {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  // Chọn một mục thì đóng menu
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) setOpen(false);
  });

  // Esc để đóng, trả focus về nút
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      setOpen(false);
      toggle.focus();
    }
  });

  // Chuyển sang màn hình rộng thì reset trạng thái
  window.matchMedia('(min-width: 1200px)').addEventListener('change', function (mq) {
    if (mq.matches) setOpen(false);
  });
})();
