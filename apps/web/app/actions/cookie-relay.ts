type SettableCookieOptions = {
    domain?: string;
    expires?: Date;
    httpOnly?: boolean;
    maxAge?: number;
    path?: string;
    sameSite?: 'lax' | 'strict' | 'none';
    secure?: boolean;
};

type SettableCookieStore = {
    set: (name: string, value: string, options?: SettableCookieOptions) => void;
};

function splitSetCookieHeader(headerValue: string): string[] {
    const values: string[] = [];
    let start = 0;
    let inExpires = false;

    for (let i = 0; i < headerValue.length; i += 1) {
        const char = headerValue[i];

        if (headerValue.slice(i, i + 8).toLowerCase() === 'expires=') {
            inExpires = true;
        }

        if (char === ';' && inExpires) {
            inExpires = false;
        }

        if (char === ',' && !inExpires) {
            values.push(headerValue.slice(start, i).trim());
            start = i + 1;
        }
    }

    values.push(headerValue.slice(start).trim());
    return values.filter(Boolean);
}

function parseSetCookie(cookieText: string) {
    const parts = cookieText
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean);
    const [nameValue, ...attrs] = parts;

    if (!nameValue) {
        return null;
    }

    const separator = nameValue.indexOf('=');
    if (separator <= 0) {
        return null;
    }

    const name = nameValue.slice(0, separator);
    const value = nameValue.slice(separator + 1);
    const options: SettableCookieOptions = {};

    for (const attr of attrs) {
        const [rawKey, ...rawValue] = attr.split('=');
        const key = rawKey.toLowerCase();
        const attrValue = rawValue.join('=');

        if (key === 'path' && attrValue) {
            options.path = attrValue;
            continue;
        }

        if (key === 'domain' && attrValue) {
            options.domain = attrValue;
            continue;
        }

        if (key === 'max-age') {
            const maxAge = Number(attrValue);
            if (Number.isFinite(maxAge)) {
                options.maxAge = maxAge;
            }
            continue;
        }

        if (key === 'expires' && attrValue) {
            const expires = new Date(attrValue);
            if (!Number.isNaN(expires.getTime())) {
                options.expires = expires;
            }
            continue;
        }

        if (key === 'httponly') {
            options.httpOnly = true;
            continue;
        }

        if (key === 'secure') {
            options.secure = true;
            continue;
        }

        if (key === 'samesite' && attrValue) {
            const normalized = attrValue.toLowerCase();
            if (normalized === 'lax' || normalized === 'strict' || normalized === 'none') {
                options.sameSite = normalized;
            }
        }
    }

    if (!options.path) {
        options.path = '/';
    }

    return { name, options, value };
}

function getSetCookieHeaders(response: Response): string[] {
    const responseHeaders = response.headers as Headers & {
        getSetCookie?: () => string[];
    };
    const fromMethod = responseHeaders.getSetCookie?.() ?? [];

    if (fromMethod.length > 0) {
        return fromMethod;
    }

    const rawSetCookie = response.headers.get('set-cookie');
    if (!rawSetCookie) {
        return [];
    }

    return splitSetCookieHeader(rawSetCookie);
}

export function relaySetCookieHeaders(response: Response, cookieStore: SettableCookieStore) {
    for (const setCookieText of getSetCookieHeaders(response)) {
        const parsed = parseSetCookie(setCookieText);
        if (!parsed) {
            continue;
        }

        cookieStore.set(parsed.name, parsed.value, parsed.options);
    }
}
