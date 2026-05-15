'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { type LogoutActionState, logoutAction } from '../../app/actions/logout-action';

const initialLogoutActionState: LogoutActionState = { error: null };

function LogoutSubmitButton() {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            className="w-full px-4 py-2 text-left text-sm hover:bg-base-200 disabled:opacity-50"
            disabled={pending}
            aria-busy={pending}
        >
            {pending ? (
                <span className="loading loading-spinner loading-xs mr-1" aria-hidden="true" />
            ) : null}
            ログアウト
        </button>
    );
}

export function LogoutButton() {
    const [state, formAction] = useActionState(logoutAction, initialLogoutActionState);

    return (
        <div className="relative">
            <details className="dropdown">
                <summary className="btn btn-ghost btn-sm list-none shrink-0 whitespace-nowrap">
                    アカウント
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                    >
                        <path
                            fillRule="evenodd"
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clipRule="evenodd"
                        />
                    </svg>
                </summary>
                <ul className="dropdown-content left-0 right-auto z-10 mt-1 w-44 max-w-[calc(100vw-2rem)] rounded-box border border-base-200 bg-base-100 p-1 shadow-lg sm:left-auto sm:right-0">
                    <li>
                        <Link href="/change-password" className="rounded px-4 py-2 text-sm">
                            パスワード変更
                        </Link>
                    </li>
                    <li>
                        <form action={formAction}>
                            <LogoutSubmitButton />
                        </form>
                    </li>
                </ul>
            </details>
            {state.error ? (
                <p role="alert" className="mt-1 text-xs text-error">
                    {state.error}
                </p>
            ) : null}
        </div>
    );
}
