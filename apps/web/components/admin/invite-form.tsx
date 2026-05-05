'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
    type CreateInvitationState,
    createInvitationAction,
} from '../../app/actions/admin-actions';

const initialState: CreateInvitationState = { error: null, success: false };

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
            {pending ? '送信中…' : '招待メールを送信'}
        </button>
    );
}

export function InviteForm() {
    const [state, formAction] = useActionState(createInvitationAction, initialState);

    return (
        <form action={formAction} className="flex flex-col gap-8">
            <label className="form-control w-full gap-2">
                <span className="label-text text-sm font-medium">メールアドレス</span>
                <input
                    className="input input-bordered w-full"
                    name="email"
                    type="email"
                    autoComplete="off"
                    placeholder="invitee@example.com"
                    required
                />
            </label>

            <fieldset className="form-control gap-2">
                <legend className="label-text text-sm font-medium">ロール</legend>
                <div className="flex gap-4 pt-1">
                    <label className="flex cursor-pointer items-center gap-2">
                        <input
                            type="radio"
                            name="role"
                            value="member"
                            className="radio radio-sm"
                            defaultChecked
                        />
                        <span className="text-sm">メンバー</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                        <input
                            type="radio"
                            name="role"
                            value="admin"
                            className="radio radio-sm"
                        />
                        <span className="text-sm">管理者</span>
                    </label>
                </div>
            </fieldset>

            {state.success ? (
                <div className="alert alert-success py-3 text-sm" role="status" aria-live="polite">
                    <span>招待メールを送信しました。</span>
                </div>
            ) : state.error ? (
                <div className="alert alert-error py-3 text-sm" role="status" aria-live="polite">
                    <span>{state.error}</span>
                </div>
            ) : null}

            <div className="flex justify-end pt-2">
                <SubmitButton />
            </div>
        </form>
    );
}
