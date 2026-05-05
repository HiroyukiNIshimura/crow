import Image from 'next/image';
import { notFound } from 'next/navigation';
import { AcceptInvitationForm } from '../../components/auth/accept-invitation-form';

type Props = {
    searchParams: Promise<{ token?: string }>;
};

export default async function AcceptInvitationPage({ searchParams }: Props) {
    const { token } = await searchParams;

    if (!token) {
        notFound();
    }

    return (
        <main className="app-shell flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-md space-y-5">
                <div className="space-y-2 text-center">
                    <div className="flex justify-center">
                        <div className="w-28 h-28">
                            <Image
                                src="/images/logo.webp"
                                alt="Crow"
                                width={112}
                                height={112}
                                priority
                                unoptimized
                            />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">アカウント作成</h1>
                    <p className="text-sm text-base-content/60">
                        表示名とパスワードを設定してアカウントを作成してください。
                    </p>
                </div>

                <AcceptInvitationForm token={token} />
            </div>
        </main>
    );
}
