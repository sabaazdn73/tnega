// theme.js: the site's theme control for the static notebook pages.
//
// Same behaviour as the React control on the home page
// (src/theme/ThemeProvider.jsx and src/theme/ThemeToggle.jsx), with the same
// three positions (System, Light, Dark) and the same store,
// localStorage['tnega_theme'], so a choice made on either side holds on the
// other. `system` follows the operating system and keeps following it with no
// reload; `light` and `dark` hold whatever the system says.
//
// Loaded without defer at the top of <head>, so the mode is on <html> before
// the first paint and a dark-mode visitor never sees one light frame. The
// selected position is drawn from html[data-theme-mode] in style.css, so it is
// right in that first frame too; the buttons are wired once the page is
// parsed. An external file rather than an inline script, because the site's
// Content-Security-Policy allows scripts from 'self' and one hashed inline
// script on the home page only.
(function () {
  var KEY = 'tnega_theme';
  var MODES = ['system', 'light', 'dark'];
  var QUERY = '(prefers-color-scheme: dark)';
  // theme-color repeats --panel from style.css (the header the status bar sits on).
  var BAR = { light: '#fbfaf7', dark: '#1c2024' };
  var root = document.documentElement;
  var persisted = true;
  var memory = null; // the mode for this page when site data is blocked

  function read() {
    try {
      var v = window.localStorage.getItem(KEY);
      return MODES.indexOf(v) >= 0 ? v : 'system';
    } catch (e) {
      persisted = false;
      return memory || 'system';
    }
  }

  function write(mode) {
    memory = mode;
    try {
      window.localStorage.setItem(KEY, mode);
      persisted = true;
    } catch (e) {
      persisted = false;
    }
  }

  function prefersDark() {
    try {
      return !!(window.matchMedia && window.matchMedia(QUERY).matches);
    } catch (e) {
      return false;
    }
  }

  var mode = read();

  function apply() {
    var dark = mode === 'dark' || (mode === 'system' && prefersDark());
    if (dark) root.classList.add('dark'); else root.classList.remove('dark');
    root.setAttribute('data-theme-mode', mode);
    root.style.colorScheme = dark ? 'dark' : 'light';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? BAR.dark : BAR.light);
    var group = document.querySelector('.theme');
    if (!group) return;
    var buttons = group.querySelectorAll('[data-mode]');
    for (var i = 0; i < buttons.length; i++) {
      var on = buttons[i].getAttribute('data-mode') === mode;
      buttons[i].setAttribute('aria-checked', on ? 'true' : 'false');
      buttons[i].tabIndex = on ? 0 : -1;
    }
    if (persisted) group.removeAttribute('title');
    else group.setAttribute('title', 'This browser is not saving site data, so the theme resets on the next visit.');
  }

  function set(next) {
    if (MODES.indexOf(next) < 0) return;
    mode = next;
    write(next);
    apply();
  }

  root.classList.add('js');
  apply();

  function wire() {
    var group = document.querySelector('.theme');
    if (group) {
      group.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-mode]') : null;
        if (b) set(b.getAttribute('data-mode'));
      });
      // A radio group: arrow keys move between the positions.
      group.addEventListener('keydown', function (e) {
        var i = MODES.indexOf(mode);
        var next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = MODES[(i + 1) % MODES.length];
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = MODES[(i + MODES.length - 1) % MODES.length];
        if (!next) return;
        e.preventDefault();
        set(next);
        var b = group.querySelector('[data-mode="' + next + '"]');
        if (b) b.focus();
      });
    }
    apply();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();

  // Follow the system while it can matter; the listener stays on in every mode
  // so that switching back to System picks up the current value at once.
  try {
    var mq = window.matchMedia(QUERY);
    var onChange = function () { apply(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  } catch (e) {}

  // Another tab (a notebook page or the home page) changed the mode: follow it.
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) { mode = read(); apply(); }
  });
})();
