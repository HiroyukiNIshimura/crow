'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
    type ForgotPasswordActionState,
    forgotPasswordAction,
} from '../../app/actions/forgot-password-action';

const initialState: ForgotPasswordActionState = { error: null, success: false };

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
            {pending ? '送信中…' : '再設定メールを送信'}
        </button>
    );
}

export function ForgotPasswordForm() {
    const [state, formAction] = useActionState(forgotPasswordAction, initialState);

    if (state.success) {
        return (
            <div className="alert alert-success py-4 text-sm" role="status">
                <span>
                    登録済みのメールアドレスであれば、パスワード再設定メールを送信しました。
                    メールをご確認ください。
                </span>
            </div>
        );
    }

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
