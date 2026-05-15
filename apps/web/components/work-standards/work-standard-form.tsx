'use client';

import { useActionState, useCallback } from 'react';
import { useFormStatus } from 'react-dom';
import {
    type UpsertWorkStandardResult,
    upsertWorkStandard,
    type WorkStandard,
} from '../../app/actions/work-standards-actions';

type Props = {
    year: number;
    month: number;
    current: WorkStandard | null;
};

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
            {pending ? '保存中…' : '保存する'}
        </button>
    );
}

const initialState: UpsertWorkStandardResult = { success: false, error: '' };

export function WorkStandardForm({ year, month, current }: Props) {
    const boundAction = useCallback(
        (_prev: UpsertWorkStandardResult, formData: FormData) =>
            upsertWorkStandard(_prev, formData),
        [],
    );
    const [state, formAction] = useActionState(boundAction, initialState);

    return (
        <form className="flex flex-col gap-4" action={formAction}>
            <input type="hidden" name="year" value={year} />
            <input type="hidden" name="month" value={month} />

            <label className="form-control w-full gap-2">
                <span className="label-text text-sm font-medium">1日の稼働時間（時間）</span>
                <input
                    className="input input-bordered w-full"
                    name="hoursPerDay"
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    defaultValue={current?.hoursPerDay ?? 8}
                    required
                />
            </label>

            <label className="form-control w-full gap-2">
                <span className="label-text text-sm font-medium">
                    稼働日数（空白で自動計算・土日除外）
                </span>
                <input
                    className="input input-bordered w-full"
                    name="workDaysInMonth"
                    type="number"
                    step="1"
                    min="1"
                    max="31"
                    defaultValue={current?.workDaysInMonth ?? ''}
                    placeholder="空白で自動計算"
                />
            </label>

            {'success' in state && state.success ? (
                <div className="alert alert-success py-3 text-sm" role="status" aria-live="polite">
                    <span>
                        保存しました。基準時間: <strong>{state.data.totalHours} 時間</strong>（
                        {state.data.workDaysInMonth} 日 × {state.data.hoursPerDay} 時間）
                    </span>
                </div>
            ) : null}

            {'error' in state && state.error ? (
                <div className="alert alert-error py-3 text-sm" role="alert" aria-live="polite">
                    <span>{state.error}</span>
                </div>
            ) : null}

            <SubmitButton />
        </form>
    );
}
