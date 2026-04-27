// ================================================================
// lang.js — Language toggle (VI ↔ EN) cho Nhuniverse
// Cách dùng trong HTML:
//   data-vi="text VI"  data-en="text EN"           → swap textContent
//   data-html-vi="html VI" data-html-en="html EN"  → swap innerHTML
//   data-ph-vi="placeholder VI" data-ph-en="..."   → swap placeholder
// ================================================================
(function () {
    const KEY = 'nhun_lang';

    function getLang() { return localStorage.getItem(KEY) || 'vi'; }

    function applyLang(lang) {
        // Swap text content
        document.querySelectorAll('[data-vi]').forEach(el => {
            el.textContent = lang === 'en' ? (el.dataset.en || el.dataset.vi) : el.dataset.vi;
        });
        // Swap innerHTML (for elements with nested tags)
        document.querySelectorAll('[data-html-vi]').forEach(el => {
            el.innerHTML = lang === 'en' ? (el.dataset.htmlEn || el.dataset.htmlVi) : el.dataset.htmlVi;
        });
        // Swap placeholders
        document.querySelectorAll('[data-ph-vi]').forEach(el => {
            el.placeholder = lang === 'en' ? (el.dataset.phEn || el.dataset.phVi) : el.dataset.phVi;
        });
        // Update toggle button label
        const btn = document.getElementById('langToggle');
        if (btn) btn.textContent = lang === 'vi' ? '🌐 EN' : '🌐 VI';
        // Update html[lang]
        document.documentElement.lang = lang;
    }

    // Exposed globals
    window.toggleLang = function () {
        const next = getLang() === 'vi' ? 'en' : 'vi';
        localStorage.setItem(KEY, next);
        applyLang(next);
    };

    window.getLang = function () { return getLang(); };

    // My CV alert — language-aware
    window.showCvAlert = function () {
        const msg = getLang() === 'en'
            ? "This is a secret, you can't peek 😜"
            : 'Đây là secret nên hông xem được đâu nha 😜';
        alert(msg);
    };

    // Apply on DOM ready
    document.addEventListener('DOMContentLoaded', () => applyLang(getLang()));
})();
