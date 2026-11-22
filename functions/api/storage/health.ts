import { buildCorsHeaders, jsonResponse } from "../../lib/r2-security";
import type { StorageEnv } from "../../lib/r2-types";

export type BindingHealthStatus = "configured" | "not_configured" | "unreachable";

export const onRequestOptions = async (context: { request: Request; env: StorageEnv }) => {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(context.request, context.env),
  });
};

export const onRequestGet = async (context: { request: Request; env: StorageEnv }) => {
  const { request, env } = context;

  const hasPublicBinding = Boolean(env.R2_PUBLIC);
  const hasPrivateBinding = Boolean(env.R2_PRIVATE);
  const cdnBase = (env.PUBLIC_R2_CDN_URL || "").trim();

  let publicReachable = false;
  let privateReachable = false;

  if (env.R2_PUBLIC) {
    try {
      await env.R2_PUBLIC.list({ limit: 1 });
      publicReachable = true;
    } catch {
      publicReachable = false;
    }
  }

  if (env.R2_PRIVATE) {
    try {
      await env.R2_PRIVATE.list({ limit: 1 });
      privateReachable = true;
    } catch {
      privateReachable = false;
    }
  }

  const publicStatus: BindingHealthStatus = !hasPublicBinding
    ? "not_configured"
    : publicReachable
      ? "configured"
      : "unreachable";

  const privateStatus: BindingHealthStatus = !hasPrivateBinding
    ? "not_configured"
    : privateReachable
      ? "configured"
      : "unreachable";

  const healthy = publicStatus === "configured" && privateStatus === "configured";

  return jsonResponse(
    {
      ok: healthy,
      provider: "cloudflare-r2",
      bindings: {
        R2_PUBLIC: publicStatus,
        R2_PRIVATE: privateStatus,
      },
      publicReady: publicStatus === "configured",
      privateReady: privateStatus === "configured",
      cdnConfigured: Boolean(cdnBase && /^https?:\/\//i.test(cdnBase)),
      timestamp: new Date().toISOString(),
    },
    healthy ? 200 : 503,
    request,
    env
  );
};
