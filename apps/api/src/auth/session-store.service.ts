import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

type SessionRecord = {
  token: string;
  userId: string;
  email: string;
  displayName: string;
  role: 'admin' | 'member';
  expiresAt: Date;
  lastSeenAt: Date;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class SessionStoreService {
  /**
   * NOTE:
   * これは初期スタブ用のメモリストアです。
   * 本実装では PostgreSQL-backed sessions に置き換えます。
   */
  private readonly sessions = new Map<string, SessionRecord>();

  create(input: Omit<SessionRecord, 'token' | 'expiresAt' | 'lastSeenAt'>) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    const lastSeenAt = new Date();

    const session: SessionRecord = {
      token,
      expiresAt,
      lastSeenAt,
      ...input,
    };

    this.sessions.set(token, session);
    return session;
  }

  get(token: string) {
    const session = this.sessions.get(token);

    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      this.sessions.delete(token);
      return null;
    }

    session.lastSeenAt = new Date();
    return session;
  }

  revoke(token: string) {
    this.sessions.delete(token);
  }
}