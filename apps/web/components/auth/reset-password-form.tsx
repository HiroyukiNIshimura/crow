'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import {
    type ResetPasswordActionState,
    resetPasswordAction,
} from '../../app/actions/reset-password-action';

const initialState: ResetPasswordActionState = { error: null, success: false };

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
            {pending ? '変更中…' : 'パスワードを変更する'}
        </button>
    );
}

type Props = {
    token: string;
};

export function ResetPasswordForm({ token }: Props) {
    const router = useRouter();
    const [state, formAction] = useActionState(resetPasswordAction, initialState);

    useEffect(() => {
        if (!state.success) {
            return;
        }

        router.replace('/login?reset=1');
    }, [router, state.success]);

    return (
        <section className="card border border-base-200 bg-base-100 shadow-2xl">
            <div className="card-body gap-5 p-5 sm:p-7">
                <form className="flex flex-col gap-4" action={formAction}>
                    <input type="hidden" name="token" value={token} />

                    <label className="form-control w-full gap-2">
                        <span className="label-text text-sm font-medium">新しいパスワード</span>
                        <input
                            className="input input-bordered w-full"
                            name="newPassword"
                            type="password"
                            autoComplete="new-password"
                            placeholder="••••••••"
                            required
                            minLength={8}
                        />
                    </label>

                    <label className="form-control w-full gap-2">
                        <span className="label-text text-sm font-medium">新しいパスワード（確認）</span>
                        <input
                            className="input input-bordered w-full"
                            name="confirmPassword"
                            type="password"
                            autoComplete="new-password"
                            placeholder="••••••••"
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

                <div className="text-center text-sm text-base-content/60">
                    <Link href="/login" className="link link-primary">
                        ログインに戻る
                    </Link>
                </div>
            </div>
        </section>
    );
}
