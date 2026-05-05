'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const TABS = [
    { id: 'invite', label: 'ユーザーを招待' },
    { id: 'users', label: 'ユーザー管理' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function AdminTabNav() {
    const searchParams = useSearchParams();
    const currentTab = (searchParams.get('tab') ?? 'invite') as TabId;

    return (
        <div role="tablist" className="tabs tabs-border">
            {TABS.map((tab) => {
                const params = new URLSearchParams(searchParams.toString());
                params.set('tab', tab.id);
                // タブ切替時はメッセージ系クエリをリセット
                params.delete('error');
                params.delete('success');

                return (
                    <Link
                        key={tab.id}
                        href={`?${params.toString()}`}
                        role="tab"
                        aria-selected={currentTab === tab.id}
                        className={`tab ${currentTab === tab.id ? 'tab-active' : ''}`}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </div>
    );
}
