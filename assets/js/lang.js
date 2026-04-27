// ================================================================
// lang.js — Language toggle (VI ↔ EN) + Auto-translate dynamic content
// Static elements: use data-vi / data-en / data-html-vi / data-html-en
// Dynamic content: use data-translatable (auto-translated via Google)
// ================================================================
(function () {
    const KEY = 'nhun_lang';
    const memCache = {};  // in-memory cache

    function getLang() { return localStorage.getItem(KEY) || 'vi'; }

    // ---- Cache helpers (sessionStorage for cross-navigation persistence) ----
    function fromCache(text) {
        if (memCache[text]) return memCache[text];
        try {
            const v = sessionStorage.getItem('t:' + text);
            if (v) { memCache[text] = v; return v; }
        } catch {}
        return null;
    }
    function toCache(text, translated) {
        memCache[text] = translated;
        try { sessionStorage.setItem('t:' + text, translated); } catch {}
    }

    // ---- Google Translate (unofficial, free, no key needed) ----
    async function translateText(text) {
        if (!text || !text.trim() || text.trim().length < 2) return text;
        const cached = fromCache(text);
        if (cached) return cached;
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=en&dt=t&q=${encodeURIComponent(text)}`;
            const res = await fetch(url);
            const data = await res.json();
            const translated = data[0].map(arr => arr[0]).join('');
            toCache(text, translated);
            return translated;
        } catch {
            return text; // fallback silently
        }
    }

    // ---- Apply static translations (data-vi / data-en) ----
    function applyStatic(lang) {
        document.querySelectorAll('[data-vi]').forEach(el => {
            el.textContent = lang === 'en' ? (el.dataset.en || el.dataset.vi) : el.dataset.vi;
        });
        document.querySelectorAll('[data-html-vi]').forEach(el => {
            el.innerHTML = lang === 'en' ? (el.dataset.htmlEn || el.dataset.htmlVi) : el.dataset.htmlVi;
        });
        document.querySelectorAll('[data-ph-vi]').forEach(el => {
            el.placeholder = lang === 'en' ? (el.dataset.phEn || el.dataset.phVi) : el.dataset.phVi;
        });
        const btn = document.getElementById('langToggle');
        if (btn) btn.textContent = lang === 'vi' ? '🌐 EN' : '🌐 VI';
        document.documentElement.lang = lang;
    }

    // ---- Apply dynamic translations ([data-translatable]) ----
    async function applyDynamic(lang) {
        const elements = document.querySelectorAll('[data-translatable]');
        if (!elements.length) return;

        if (lang === 'vi') {
            elements.forEach(el => {
                if (el.dataset.original !== undefined) el.textContent = el.dataset.original;
            });
            return;
        }

        // EN: translate all, in parallel
        const tasks = Array.from(elements).map(async el => {
            // Save original VI text on first run
            if (el.dataset.original === undefined) {
                el.dataset.original = el.textContent.trim();
            }
            const original = el.dataset.original;
            if (!original) return;
            const translated = await translateText(original);
            el.textContent = translated;
        });

        await Promise.all(tasks);
    }

    // ---- Full lang application ----
    async function applyLang(lang) {
        applyStatic(lang);
        await applyDynamic(lang);
    }

    // ---- Public API ----

    // Toggle VI ↔ EN (called by button click)
    window.toggleLang = async function () {
        const next = getLang() === 'vi' ? 'en' : 'vi';
        localStorage.setItem(KEY, next);

        const btn = document.getElementById('langToggle');
        if (btn && next === 'en') {
            btn.textContent = '⏳';
            btn.disabled = true;
        }

        await applyLang(next);

        if (btn) {
            btn.disabled = false;
            btn.textContent = next === 'vi' ? '🌐 EN' : '🌐 VI';
        }
    };

    // Called by api.js / product-detail.js after rendering dynamic content
    window.applyCurrentLang = async function () {
        await applyLang(getLang());
    };

    window.getLang = function () { return getLang(); };

    // My CV alert — language-aware
    window.showCvAlert = function () {
        alert(getLang() === 'en'
            ? "This is a secret, you can't peek 😜"
            : 'Đây là secret nên hông xem được đâu nha 😜');
    };

    // Apply on initial load (handles static UI elements)
    document.addEventListener('DOMContentLoaded', () => applyLang(getLang()));
})();
