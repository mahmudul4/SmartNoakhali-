/**
 * Smart Noakhali — Cloudflare Worker Entry Point (Workers + Static Assets Architecture)
 *
 * Routes `/api/*` through secure Worker logic (Firebase ID Token RS256 verification +
 * Cloudflare R2 Public/Private Buckets CRUD) while delegating all website pages,
 * SPA navigation routes, and static PWA assets cleanly to `env.ASSETS`.
 */

import * as healthFn from "../functions/api/storage/health";
import * as uploadFn from "../functions/api/storage/upload";
import * as migrateFn from "../functions/api/storage/migrate";
import * as fileFn from "../functions/api/storage/file/[[path]]";
import { buildCorsHeaders, jsonResponse } from "../functions/lib/r2-security";
import type { StorageEnv } from "../functions/lib/r2-types";

export interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

function methodNotAllowed(allowed: string[], request: Request, env: StorageEnv): Response {
  const res = jsonResponse(
    {
      ok: false,
      error: `Method ${request.method} not allowed`,
    },
    405,
    request,
    env
  );
  res.headers.set("Allow", allowed.join(", "));
  return res;
}

async function handleApiRequest(request: Request, env: StorageEnv): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(request, env),
    });
  }

  // 1. General & Storage Health Endpoints
  if (pathname === "/api/health" || pathname === "/api/storage/health") {
    if (method === "GET" || method === "HEAD") {
      const res = await healthFn.onRequestGet({ request, env });
      if (method === "HEAD") {
        return new Response(null, { status: res.status, headers: res.headers });
      }
      return res;
    }
    return methodNotAllowed(["GET", "HEAD", "OPTIONS"], request, env);
  }

  // 2. Upload to Cloudflare R2 (Public or Private bucket)
  if (pathname === "/api/storage/upload") {
    if (method === "POST") {
      return uploadFn.onRequestPost({ request, env });
    }
    return methodNotAllowed(["POST", "OPTIONS"], request, env);
  }

  // 3. Super Admin Migration Endpoint (Firebase Storage / Built-in Category Icons -> R2)
  if (pathname === "/api/storage/migrate") {
    if (method === "POST") {
      return migrateFn.onRequestPost({ request, env });
    }
    return methodNotAllowed(["POST", "OPTIONS"], request, env);
  }

  // 4. R2 File Read, Update (PUT/PATCH), and Delete API: `/api/storage/file/(public|private)/<objectKey>`
  if (pathname.startsWith("/api/storage/file/")) {
    const rawRel = pathname.slice("/api/storage/file/".length);
    const segments = rawRel.split("/").filter(Boolean);
    const ctx = {
      request,
      env,
      params: { path: segments },
    };

    if (method === "GET") return fileFn.onRequestGet(ctx);
    if (method === "HEAD") return fileFn.onRequestHead(ctx);
    if (method === "PUT") return fileFn.onRequestPut(ctx);
    if (method === "PATCH") return fileFn.onRequestPatch(ctx);
    if (method === "DELETE") return fileFn.onRequestDelete(ctx);
    return methodNotAllowed(["GET", "HEAD", "PUT", "PATCH", "DELETE", "OPTIONS"], request, env);
  }

  // Unhandled `/api/*` routes return JSON 404 so client static fallback (legacy endpoints) works cleanly
  // without ever receiving `index.html`.
  return jsonResponse(
    {
      ok: false,
      error: "API endpoint not found on edge worker",
      path: pathname,
    },
    404,
    request,
    env
  );
}

export default {
  async fetch(
    request: Request,
    env: StorageEnv,
    _ctx: WorkerExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      try {
        return await handleApiRequest(request, env);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Internal Worker Error";
        return jsonResponse(
          {
            ok: false,
            error: "সার্ভার অনুরোধ প্রক্রিয়াকরণে ত্রুটি হয়েছে।",
            detail: message,
          },
          500,
          request,
          env
        );
      }
    }

    // All non-API traffic serves compiled Vite static assets & SPA routes via Assets binding
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("ASSETS binding is not configured in wrangler.jsonc", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  },
};
