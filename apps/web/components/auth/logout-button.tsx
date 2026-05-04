'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { type LogoutActionState, logoutAction } from '../../app/actions/logout-action';

const initialLogoutActionState: LogoutActionState = { error: null };

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            className="btn btn-ghost btn-sm"
            disabled={pending}
            aria-busy={pending}
        >
            {pending ? (
                <span className="loading loading-spinner loading-xs" aria-hidden="true" />
            ) : null}
            ログアウト
        </button>
    );
}

export function LogoutButton() {
    const [state, formAction] = useActionState(logoutAction, initialLogoutActionState);

    return (
        <form action={formAction}>
            <SubmitButton />
            {state.error ? (
                <p role="alert" className="mt-1 text-xs text-error">
                    {state.error}
                </p>
            ) : null}
        </form>
    );
}
