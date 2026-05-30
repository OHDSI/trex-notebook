import type { PreTokenGenerationTriggerEvent } from 'aws-lambda';

/**
 * Copy custom:siteId into the access token so site-operators carry their siteId claim.
 * (Custom attributes are not in the access token by default.)
 */
export async function preTokenGen(
  event: PreTokenGenerationTriggerEvent,
): Promise<PreTokenGenerationTriggerEvent> {
  const siteId = event.request.userAttributes['custom:siteId'];
  if (siteId) {
    event.response = {
      claimsOverrideDetails: {
        claimsToAddOrOverride: { siteId },
      },
    };
  }
  return event;
}
