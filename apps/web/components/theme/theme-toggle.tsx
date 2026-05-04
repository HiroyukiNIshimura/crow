'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const storageKey = 'crow-theme';

function resolveInitialTheme(): Theme {
    const storedTheme = window.localStorage.getItem(storageKey);

    if (storedTheme === 'light' || storedTheme === 'dark') {
        return storedTheme;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle() {
    const [theme, setTheme] = useState<Theme>('light');
    const isDark = theme === 'dark';

    useEffect(() => {
        const initialTheme = resolveInitialTheme();
        setTheme(initialTheme);
        applyTheme(initialTheme);
    }, []);

    function handleToggle() {
        const nextTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(nextTheme);
        window.localStorage.setItem(storageKey, nextTheme);
        applyTheme(nextTheme);
    }

    return (
        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-base-content/80 transition hover:bg-base-200/70">
            <span aria-hidden="true" className="text-base leading-none">
                ☀
            </span>
            <input
                type="checkbox"
                className="toggle toggle-primary toggle-sm"
                aria-label="ダークテーマに切り替え"
                aria-checked={isDark}
                role="switch"
                checked={isDark}
                onChange={handleToggle}
            />
            <span aria-hidden="true" className="text-base leading-none">
                ☾
            </span>
        </label>
    );
}
