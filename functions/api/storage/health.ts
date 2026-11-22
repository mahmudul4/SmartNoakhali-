import { verifyAuthenticatedActor } from "../../lib/firebase-auth";
import { buildCorsHeaders, jsonResponse } from "../../lib/r2-security";
import type { StorageEnv } from "../../lib/r2-types";

export const onRequestOptions = async (context: { request: Request; env: StorageEnv }) => {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(context.request, context.env),
  });
};

export const onRequestGet = async (context: { request: Request; env: StorageEnv }) => {
  const { request, env } = context;

  // Require valid Firebase Auth session for detailed diagnostics; unauthenticated callers get minimal availability status
  let isAuthorizedInspector = false;
  try {
    const actor = await verifyAuthenticatedActor(request, env);
    isAuthorizedInspector = actor.isMainAdmin || actor.isStaff;
  } catch {
    isAuthorizedInspector = false;
  }

  const hasPublicBinding = Boolean(env.R2_PUBLIC);
  const hasPrivateBinding = Boolean(env.R2_PRIVATE);
  const cdnBase = (env.PUBLIC_R2_CDN_URL || "").trim().replace(/\/+$/, "");

  let publicReachable = false;
  let privateReachable = false;
  let publicSampleCount = 0;
  let privateSampleCount = 0;

  if (env.R2_PUBLIC) {
    try {
      const list = await env.R2_PUBLIC.list({ limit: 5 });
      publicReachable = true;
      publicSampleCount = list.objects?.length || 0;
    } catch {
      publicReachable = false;
    }
  }

  if (env.R2_PRIVATE) {
    try {
      const list = await env.R2_PRIVATE.list({ limit: 5 });
      privateReachable = true;
      privateSampleCount = list.objects?.length || 0;
    } catch {
      privateReachable = false;
    }
  }

  const healthy = hasPublicBinding && hasPrivateBinding && publicReachable && privateReachable;

  if (!isAuthorizedInspector) {
    return jsonResponse(
      {
        ok: healthy,
        provider: "cloudflare-r2",
        publicReady: hasPublicBinding && publicReachable,
        privateReady: hasPrivateBinding && privateReachable,
        cdnConfigured: Boolean(cdnBase),
        timestamp: new Date().toISOString(),
      },
      healthy ? 200 : 503,
      request,
      env
    );
  }

  return jsonResponse(
    {
      ok: healthy,
      provider: "cloudflare-r2",
      buckets: {
        public: {
          binding: "R2_PUBLIC",
          bucketName: "smart-noakhali-public",
          bound: hasPublicBinding,
          reachable: publicReachable,
          sampleObjectsFound: publicSampleCount,
          deliveryBase: cdnBase || "/api/storage/file/public",
        },
        private: {
          binding: "R2_PRIVATE",
          bucketName: "smart-noakhali-private",
          bound: hasPrivateBinding,
          reachable: privateReachable,
          sampleObjectsFound: privateSampleCount,
          deliveryBase: "/api/storage/file/private",
        },
      },
      cdnConfigured: Boolean(cdnBase),
      cdnUrl: cdnBase || null,
      authVerification: "firebase-rs256-jwks",
      timestamp: new Date().toISOString(),
    },
    healthy ? 200 : 503,
    request,
    env
  );
};
