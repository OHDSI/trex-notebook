import type { RequestContext } from './lib/context';
import type { Deps } from './lib/deps';
import { type HandlerResult } from './lib/http';
import { notFound } from './lib/errors';
import { health } from './handlers/health';
import * as sites from './handlers/sites';
import * as studies from './handlers/studies';
import * as subs from './handlers/submissions';

type Handler = (ctx: RequestContext, deps: Deps) => Promise<HandlerResult>;

const routes: Record<string, Handler> = {
  'GET /health': () => health(),

  'POST /sites': sites.createSite,
  'GET /sites': sites.listSites,
  'GET /sites/{siteId}': sites.getSite,
  'PATCH /sites/{siteId}': sites.updateSite,
  'DELETE /sites/{siteId}': sites.deleteSite,
  'POST /sites/{siteId}/rotate-secret': sites.rotateSecret,
  'POST /sites/{siteId}/operators': sites.createOperator,

  'POST /studies': studies.createStudy,
  'PATCH /studies/{studyId}': studies.updateStudy,
  'POST /studies/{studyId}/publish': studies.publishStudy,
  'POST /studies/{studyId}/archive': studies.archiveStudy,
  'GET /studies': studies.listStudies,
  'GET /studies/{studyId}': studies.getStudy,
  'GET /studies/{studyId}/package': studies.getPackage,

  'POST /studies/{studyId}/submissions': subs.initiateSubmission,
  'POST /submissions/{subId}/complete': subs.completeSubmission,
  'GET /studies/{studyId}/submissions': subs.listSubmissionsByStudy,
  'GET /sites/{siteId}/submissions': subs.listSubmissionsBySite,
  'GET /submissions/{subId}': subs.getSubmission,
};

export async function route(ctx: RequestContext, deps: Deps): Promise<HandlerResult> {
  const handler = routes[ctx.routeKey];
  if (!handler) throw notFound('ROUTE_NOT_FOUND', `no route for ${ctx.routeKey}`);
  return handler(ctx, deps);
}
