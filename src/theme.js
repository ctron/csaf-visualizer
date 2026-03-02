const STORAGE_KEY = 'csaf-theme';
function readStorage() {
    const val = localStorage.getItem(STORAGE_KEY);
    return val === 'dark' || val === 'light' ? val : null;
}
function writeStorage(theme) {
    localStorage.setItem(STORAGE_KEY, theme);
}
function systemPrefersDark() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
function applyTheme(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
}
function updateToggleButton(theme) {
    const btn = document.getElementById('theme-toggle');
    if (!btn)
        return;
    btn.textContent = theme === 'dark' ? '☀ Light' : '☾ Dark';
    btn.setAttribute('title', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}
let mediaListener = null;
let userOverride = false;
export function initTheme() {
    const stored = readStorage();
    if (stored) {
        userOverride = true;
        applyTheme(stored);
    }
    else {
        userOverride = false;
        applyTheme(systemPrefersDark() ? 'dark' : 'light');
    }
    updateToggleButton(currentTheme());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mediaListener = () => {
        if (!userOverride) {
            applyTheme(mq.matches ? 'dark' : 'light');
            updateToggleButton(currentTheme());
        }
    };
    mq.addEventListener('change', mediaListener);
}
export function toggleTheme() {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    userOverride = true;
    applyTheme(next);
    writeStorage(next);
    updateToggleButton(next);
}
function currentTheme() {
    return document.documentElement.getAttribute('data-bs-theme') === 'light' ? 'light' : 'dark';
}
