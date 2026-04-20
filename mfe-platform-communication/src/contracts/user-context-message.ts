import type { MessageBase } from './message-base.js';

export interface UserContext {
  readonly userId: string;
  readonly displayName: string;
  readonly avatarUrl?: string;
  readonly rolesForUi: readonly string[];
  readonly tenantId?: string;
  readonly locale?: string;
  readonly featureFlags?: Readonly<Record<string, boolean>>;
  readonly sessionVersion?: string;
}

export interface UserContextMessage extends MessageBase {
  readonly kind: 'user-context';
  readonly payload: UserContext;
}
