'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { type LoginActionState, loginAction } from '../../app/actions/login-actions';

const initialLoginActionState: LoginActionState = { error: null, success: false };

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
            {pending ? 'ログイン中…' : 'ログイン'}
        </button>
    );
}

export function LoginForm() {
    const router = useRouter();
    const [state, formAction] = useActionState(loginAction, initialLoginActionState);

    useEffect(() => {
        if (!state.success) {
            return;
        }

        router.replace('/');
        router.refresh();
    }, [router, state.success]);

    return (
        <section className="card border border-base-200 bg-base-100 shadow-2xl">
            <div className="card-body gap-5 p-5 sm:p-7">
                <form className="flex flex-col gap-4" action={formAction}>
                    <label className="form-control w-full gap-2">
                        <span className="label-text text-sm font-medium">メールアドレス</span>
                        <input
                            className="input input-bordered w-full"
                            name="email"
                            type="email"
                            autoComplete="email"
                            placeholder="you@example.com"
                            required
                        />
                    </label>

                    <label className="form-control w-full gap-2">
                        <span className="label-text text-sm font-medium">パスワード</span>
                        <input
                            className="input input-bordered w-full"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            placeholder="••••••••"
                            required
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
