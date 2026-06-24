(function () {
  'use strict';

  // ── LOADER ──
  window.addEventListener('load', function () {
    const loader = document.getElementById('gmr-loader');
    if (loader) setTimeout(function () { loader.classList.add('done'); }, 900);
  });

  // ── CURSOR — direct tracking, no lerp, uses transform not left/top ──
  (function initCursor() {
    const cursor = document.getElementById('gmr-cursor');
    if (!cursor || window.matchMedia('(pointer: coarse)').matches) return;
    cursor.style.position = 'fixed';
    cursor.style.top = '0';
    cursor.style.left = '0';
    document.addEventListener('mousemove', function (e) {
      cursor.style.transform = 'translate(' + e.clientX + 'px, ' + e.clientY + 'px) translate(-50%, -50%)';
    }, { passive: true });
    document.addEventListener('mouseleave', function () { cursor.style.opacity = '0'; }, { passive: true });
    document.addEventListener('mouseenter', function () { cursor.style.opacity = '1'; }, { passive: true });
    document.addEventListener('mouseover', function (e) {
      if (e.target.matches('a, button, [data-cursor]')) cursor.classList.add('expanded');
    }, { passive: true });
    document.addEventListener('mouseout', function (e) {
      if (e.target.matches('a, button, [data-cursor]')) cursor.classList.remove('expanded');
    }, { passive: true });
  })();

  // ── CACHED LAYOUT VALUES — read once, not on every scroll frame ──
  var navEl       = null;
  var progressBar = null;
  var wheelZone   = null;
  var wheelSvg    = null;
  var arcFill     = null;
  var angleEl     = null;
  var revealEl    = null;
  var wheelCompleted = false;
  var CIRC = 2 * Math.PI * 96;

  var cachedZoneTop = 0;
  var cachedZoneH   = 0;
  var cachedScrollH = 0;

  function cacheLayout() {
    if (!navEl)       navEl       = document.getElementById('gmr-nav');
    if (!progressBar) progressBar = document.getElementById('gmr-progress');
    if (!wheelZone)   wheelZone   = document.getElementById('gmr-wheel-zone');
    if (!wheelSvg)    wheelSvg    = document.getElementById('gmr-wheel-svg');
    if (!arcFill)     arcFill     = document.getElementById('gmr-arc-fill');
    if (!angleEl)     angleEl     = document.getElementById('gmr-wheel-angle');
    if (!revealEl)    revealEl    = document.getElementById('gmr-wheel-reveal');
    if (wheelZone) {
      cachedZoneTop = wheelZone.offsetTop;
      cachedZoneH   = wheelZone.offsetHeight;
    }
    cachedScrollH = document.documentElement.scrollHeight - window.innerHeight;
  }

  window.addEventListener('load',   cacheLayout);
  window.addEventListener('resize', cacheLayout);

  // ── UNIFIED SCROLL HANDLER — single listener, RAF throttled ──
  var ticking    = false;
  var lastScrollY = 0;

  function onScrollFrame() {
    lastScrollY = window.scrollY;
    handleNav(lastScrollY);
    handleProgress(lastScrollY);
    handleWheelRotation(lastScrollY);
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      requestAnimationFrame(onScrollFrame);
      ticking = true;
    }
  }, { passive: true });

  // ── NAV ──
  function handleNav(scrollY) {
    if (!navEl) return;
    if (scrollY > 60) navEl.classList.add('scrolled');
    else navEl.classList.remove('scrolled');
  }

  // ── PROGRESS BAR — uses cached scrollH, no layout read ──
  function handleProgress(scrollY) {
    if (!progressBar) return;
    var pct = cachedScrollH > 0 ? (scrollY / cachedScrollH) * 100 : 0;
    progressBar.style.width = pct + '%';
  }

  // ── WHEEL ROTATION — uses cached zone dimensions, no layout read ──
  function handleWheelRotation(scrollY) {
    if (!wheelZone || !wheelSvg) return;
    var raw  = (scrollY - cachedZoneTop) / (cachedZoneH - window.innerHeight);
    var prog = Math.max(0, Math.min(1, raw));
    var angle = Math.round(prog * 360);

    wheelSvg.style.transform = 'translateZ(0) rotate(' + angle + 'deg)';

    if (arcFill) {
      arcFill.setAttribute('stroke-dasharray', (prog * CIRC) + ' ' + CIRC);
    }
    if (angleEl) {
      if (prog <= 0)      { angleEl.textContent = '0\xb0 \xb7 Scroll to rotate'; angleEl.classList.remove('complete'); }
      else if (prog >= 1) { angleEl.textContent = '360\xb0 \xb7 Complete'; angleEl.classList.add('complete'); }
      else                { angleEl.textContent = angle + '\xb0'; angleEl.classList.remove('complete'); }
    }
    if (prog >= 1 && !wheelCompleted) {
      wheelCompleted = true;
      if (revealEl) revealEl.classList.add('visible');
    } else if (prog < 0.98 && wheelCompleted) {
      wheelCompleted = false;
      if (revealEl) revealEl.classList.remove('visible');
    }
  }

  // ── SCROLL REVEAL — IntersectionObserver, no scroll listener ──
  (function initReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var el = entry.target;
          el.style.willChange = 'transform, opacity';
          el.classList.add('in');
          el.addEventListener('transitionend', function cleanup() {
            el.style.willChange = 'auto';
            el.removeEventListener('transitionend', cleanup);
          });
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    els.forEach(function (el) { observer.observe(el); });
  })();

  // ── LAZY IFRAME — only load configurator when visible ──
  (function initLazyIframe() {
    var iframe = document.querySelector('.gmr-configurator-wrap iframe[data-src]');
    if (!iframe) {
      iframe = document.querySelector('.gmr-configurator-wrap iframe');
      if (iframe && iframe.src && !iframe.dataset.lazy) {
        iframe.dataset.src  = iframe.src;
        iframe.dataset.lazy = 'true';
        iframe.removeAttribute('src');
      }
    }
    if (!iframe || !iframe.dataset.src) return;
    var observer = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        iframe.src = iframe.dataset.src;
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    observer.observe(iframe);
  })();

  // ── VIDEO PLAY ON SCROLL ──
  (function initScrollVideos() {
    var videos = document.querySelectorAll('[data-scroll-video]');
    if (!videos.length) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) entry.target.play().catch(function(){});
        else entry.target.pause();
      });
    }, { threshold: 0.3 });
    videos.forEach(function (v) { observer.observe(v); });
  })();

  // ── NAVIGATION ──
  (function initNav() {
    var hamburger  = document.getElementById('gmr-hamburger');
    var mobileMenu = document.getElementById('gmr-mobile-menu');
    var menuClose  = document.getElementById('gmr-menu-close');
    var backdrop   = document.getElementById('gmr-nav-backdrop');

    function openMenu() {
      if (mobileMenu) mobileMenu.classList.add('open');
      if (hamburger)  hamburger.classList.add('open');
      if (backdrop)   backdrop.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeMenu() {
      if (mobileMenu) mobileMenu.classList.remove('open');
      if (hamburger)  hamburger.classList.remove('open');
      if (backdrop)   backdrop.classList.remove('open');
      document.body.style.overflow = '';
    }

    if (hamburger) hamburger.addEventListener('click', function () {
      hamburger.classList.contains('open') ? closeMenu() : openMenu();
    });
    if (menuClose)  menuClose.addEventListener('click', closeMenu);
    if (backdrop)   backdrop.addEventListener('click', closeMenu);
    if (mobileMenu) mobileMenu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeMenu); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  })();

  // ── TABS ──
  document.querySelectorAll('.gmr-tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.closest('.gmr-tabs');
      if (!group) return;
      group.querySelectorAll('.gmr-tab-btn').forEach(function (b) { b.classList.remove('active'); });
      group.querySelectorAll('.gmr-tab-panel').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      var panel = group.querySelector('[data-tab-panel="' + btn.dataset.tab + '"]');
      if (panel) panel.classList.add('active');
    });
  });

  // ── MODALS ──
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-modal-open]');
    if (trigger) {
      var overlay = document.getElementById('modal-' + trigger.dataset.modalOpen);
      if (overlay) {
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        var wName = trigger.dataset.wheelName;
        if (wName) {
          var titleEl = overlay.querySelector('.gmr-modal-wheel-name');
          if (titleEl) titleEl.textContent = wName + (trigger.dataset.wheelPlatform ? ' — ' + trigger.dataset.wheelPlatform : '');
        }
      }
    }
    if (e.target.closest('[data-modal-close]') || e.target.classList.contains('gmr-modal-overlay')) {
      var open = document.querySelector('.gmr-modal-overlay.open');
      if (open) { open.classList.remove('open'); document.body.style.overflow = ''; }
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var open = document.querySelector('.gmr-modal-overlay.open');
      if (open) { open.classList.remove('open'); document.body.style.overflow = ''; }
    }
  });

  // ── FORMS ──
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.classList.contains('gmr-form')) return;
    e.preventDefault();
    var confirm = form.nextElementSibling;
    if (confirm && confirm.classList.contains('gmr-form-confirm')) {
      confirm.style.display = 'block';
      form.style.display = 'none';
    }
  });

  // ── SOUND TOGGLE ──
  document.addEventListener('click', function (e) {
    var toggle = e.target.closest('[data-sound-toggle]');
    if (!toggle) return;
    var target = document.getElementById(toggle.dataset.soundToggle);
    if (!target) return;
    target.muted = !target.muted;
    var label = toggle.querySelector('.sound-label');
    if (label) label.textContent = target.muted ? 'Listen' : 'Mute';
  });

  // ── PARALLAX ──
  (function initParallax() {
    var parallaxEls = document.querySelectorAll('.gmr-hero-bg, .gmr-video-bg');
    if (!parallaxEls.length) return;

    function updateParallax() {
      var scrollY = window.scrollY;
      parallaxEls.forEach(function(el) {
        var section = el.parentElement;
        var rect = section.getBoundingClientRect();
        var sectionTop = rect.top + scrollY;
        var offset = (scrollY - sectionTop) * 0.4;
        el.style.transform = 'translateY(' + offset + 'px) translateZ(0)';
      });
    }

    var parTicking = false;
    window.addEventListener('scroll', function() {
      if (!parTicking) {
        requestAnimationFrame(function() {
          updateParallax();
          parTicking = false;
        });
        parTicking = true;
      }
    }, { passive: true });

    updateParallax();
  })();

})();
