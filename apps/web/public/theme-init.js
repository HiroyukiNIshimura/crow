(function () {
    try {
        var storedTheme = window.localStorage.getItem('crow-theme');
        var theme =
            storedTheme === 'light' || storedTheme === 'dark'
                ? storedTheme
                : window.matchMedia('(prefers-color-scheme: dark)').matches
                  ? 'dark'
                  : 'light';

        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;
    } catch (_error) {
        document.documentElement.dataset.theme = 'light';
        document.documentElement.style.colorScheme = 'light';
    }
})();
