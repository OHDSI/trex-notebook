import { ok, type HandlerResult } from '../lib/http';

export async function health(): Promise<HandlerResult> {
  return ok({ ok: true });
}
