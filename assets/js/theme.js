/**
 * Theme Toggle — Nhuniverse
 * Áp dụng theme ngay khi load để tránh flash, lưu vào localStorage.
 */
(function () {
    const KEY = 'nhun-theme';

    function getSaved() {
        return localStorage.getItem(KEY) || 'dark';
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(KEY, theme);
        // Sync all toggle buttons on the page
        document.querySelectorAll('.theme-btn').forEach(function (btn) {
            if (theme === 'dark') {
                btn.innerHTML = '☀️';
                btn.title = 'Chuyển sang giao diện sáng';
            } else {
                btn.innerHTML = '🌙';
                btn.title = 'Chuyển sang giao diện tối';
            }
        });
    }

    // Apply ASAP (before first paint) to prevent FOUC
    applyTheme(getSaved());

    window.toggleTheme = function () {
        applyTheme(getSaved() === 'dark' ? 'light' : 'dark');
    };

    // Re-sync button icons once DOM is ready
    document.addEventListener('DOMContentLoaded', function () {
        applyTheme(getSaved());
    });
}());
