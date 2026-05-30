import { forbidden, unauthorized } from './errors';

export type Role =
  | { kind: 'coordinator'; subject: string }
  | { kind: 'site-operator'; siteId: string; subject: string }
  | { kind: 'machine'; clientId: string; subject: string };

export type Claims = Record<string, unknown>;

function parseGroups(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    return raw.replace(/^\[|\]$/g, '').split(/[\s,]+/).filter(Boolean);
  }
  return [];
}

export function resolveRole(claims: Claims): Role {
  const groups = parseGroups(claims['cognito:groups']);
  const sub = typeof claims.sub === 'string' ? claims.sub : undefined;

  if (groups.includes('coordinator') && sub) {
    return { kind: 'coordinator', subject: `user:${sub}` };
  }
  if (groups.includes('site-operator') && sub) {
    const siteId = claims.siteId;
    if (typeof siteId !== 'string' || siteId.length === 0) {
      throw forbidden('site-operator token is missing siteId claim');
    }
    return { kind: 'site-operator', siteId, subject: `user:${sub}` };
  }
  const clientId = claims.client_id;
  if (typeof clientId === 'string' && clientId.length > 0) {
    return { kind: 'machine', clientId, subject: `client:${clientId}` };
  }
  throw unauthorized('token has no recognized role');
}

export function requireCoordinator(role: Role): void {
  if (role.kind !== 'coordinator') throw forbidden('coordinator role required');
}

export function scopedSiteId(role: Role): string | null {
  if (role.kind === 'coordinator') return null;
  if (role.kind === 'site-operator') return role.siteId;
  return null;
}
