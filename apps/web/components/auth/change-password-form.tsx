'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
    type ChangePasswordActionState,
    changePasswordAction,
} from '../../app/actions/change-password-action';

const initialState: ChangePasswordActionState = { error: null, success: false };

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
            {pending ? '変更中…' : 'パスワードを変更する'}
        </button>
    );
}

export function ChangePasswordForm() {
    const [state, formAction] = useActionState(changePasswordAction, initialState);

    return (
        <section className="card border border-base-200 bg-base-100 shadow-2xl">
            <div className="card-body gap-5 p-5 sm:p-7">
                {state.success ? (
                    <div
                        className="alert alert-success py-3 text-sm"
                        role="status"
                        aria-live="polite"
                    >
                        <span>パスワードを変更しました。</span>
                    </div>
                ) : (
                    <form className="flex flex-col gap-4" action={formAction}>
                        <label className="form-control w-full gap-2">
                            <span className="label-text text-sm font-medium">現在のパスワード</span>
                            <input
                                className="input input-bordered w-full"
                                name="currentPassword"
                                type="password"
                                autoComplete="current-password"
                                placeholder="••••••••"
                                required
                            />
                        </label>

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
                            <span className="label-text text-sm font-medium">
                                新しいパスワード（確認）
                            </span>
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

                        <SubmitButton />
                    </form>
                )}
            </div>
        </section>
    );
}
