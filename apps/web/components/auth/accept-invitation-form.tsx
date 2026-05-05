'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import {
    type AcceptInvitationState,
    acceptInvitationAction,
} from '../../app/actions/invitation-actions';

const initialState: AcceptInvitationState = { error: null, success: false };

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
            {pending ? '作成中…' : 'アカウントを作成する'}
        </button>
    );
}

export function AcceptInvitationForm({ token }: { token: string }) {
    const router = useRouter();
    const [state, formAction] = useActionState(acceptInvitationAction, initialState);

    useEffect(() => {
        if (!state.success) return;
        router.replace('/');
    }, [router, state.success]);

    return (
        <section className="card border border-base-200 bg-base-100 shadow-2xl">
            <div className="card-body gap-4 px-6 py-10 sm:px-8 sm:py-12">
                <form className="flex flex-col gap-8" action={formAction}>
                    <input type="hidden" name="token" value={token} />

                    <label className="form-control w-full gap-2">
                        <span className="label-text text-sm font-medium">表示名</span>
                        <input
                            className="input input-bordered w-full"
                            name="displayName"
                            type="text"
                            autoComplete="name"
                            placeholder="山田 太郎"
                            required
                        />
                    </label>

                    <label className="form-control w-full gap-2">
                        <span className="label-text text-sm font-medium">パスワード</span>
                        <input
                            className="input input-bordered w-full"
                            name="password"
                            type="password"
                            autoComplete="new-password"
                            placeholder="8文字以上"
                            required
                            minLength={8}
                        />
                    </label>

                    {state.error ? (
                        <div
                            className="alert alert-error py-3 text-sm"
                            role="status"
                            aria-live="polite"
                        >
                            <span>{state.error}</span>
                        </div>
                    ) : null}

                    <div className="pt-2 sm:pt-3">
                        <SubmitButton />
                    </div>
                </form>
            </div>
        </section>
    );
}
