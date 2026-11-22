/**
 * Local Node.js Filesystem R2 Bucket Simulator for Express Dev Server
 * Mounts the exact Cloudflare Pages Functions (/api/storage/*) locally using
 * `.r2-local/` on disk so local development exercises identical auth, RBAC,
 * magic-byte, SVG sanitization, and private delivery behavior.
 */

import type { Express, Request as ExpressRequest, Response as ExpressResponse } from "express";
import fs from "fs";
import path from "path";
import type {
  R2BucketBinding,
  R2GetOptions,
  R2ListOptions,
  R2Object,
  R2ObjectBody,
  R2Objects,
  R2PutOptions,
  StorageEnv,
} from "./functions/lib/r2-types";
import * as healthFn from "./functions/api/storage/health";
import * as uploadFn from "./functions/api/storage/upload";
import * as fileFn from "./functions/api/storage/file/[[path]]";
import * as migrateFn from "./functions/api/storage/migrate";

interface StoredSidecarMeta {
  size: number;
  etag: string;
  uploaded: string;
  httpMetadata?: R2PutOptions["httpMetadata"];
  customMetadata?: Record<string, string>;
}

function createDiskR2Bucket(rootDir: string): R2BucketBinding {
  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir, { recursive: true });
  }

  const resolveSafe = (key: string) => {
    const clean = key.replace(/^\/+/, "");
    const target = path.resolve(rootDir, clean);
    if (!target.startsWith(rootDir + path.sep) && target !== rootDir) {
      throw new Error("Path traversal blocked");
    }
    return {
      dataPath: target,
      metaPath: `${target}.__r2meta.json`,
      cleanKey: clean,
    };
  };

  const readMeta = (metaPath: string, dataPath: string): StoredSidecarMeta | null => {
    if (!fs.existsSync(dataPath)) return null;
    const stat = fs.statSync(dataPath);
    if (fs.existsSync(metaPath)) {
      try {
        return JSON.parse(fs.readFileSync(metaPath, "utf-8")) as StoredSidecarMeta;
      } catch {
        // fallback below
      }
    }
    return {
      size: stat.size,
      etag: `"${stat.size}-${Math.floor(stat.mtimeMs)}"`,
      uploaded: stat.mtime.toISOString(),
    };
  };

  return {
    async head(key: string): Promise<R2Object | null> {
      const { dataPath, metaPath, cleanKey } = resolveSafe(key);
      const meta = readMeta(metaPath, dataPath);
      if (!meta) return null;
      return {
        key: cleanKey,
        version: "local-v1",
        size: meta.size,
        etag: meta.etag.replace(/"/g, ""),
        httpEtag: meta.etag,
        uploaded: new Date(meta.uploaded),
        httpMetadata: meta.httpMetadata,
        customMetadata: meta.customMetadata,
      };
    },

    async get(key: string, _options?: R2GetOptions): Promise<R2ObjectBody | null> {
      const { dataPath, metaPath, cleanKey } = resolveSafe(key);
      const meta = readMeta(metaPath, dataPath);
      if (!meta) return null;
      const buffer = fs.readFileSync(dataPath);
      const uint8 = new Uint8Array(buffer);
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(uint8);
          controller.close();
        },
      });
      return {
        key: cleanKey,
        version: "local-v1",
        size: buffer.byteLength,
        etag: meta.etag.replace(/"/g, ""),
        httpEtag: meta.etag,
        uploaded: new Date(meta.uploaded),
        httpMetadata: meta.httpMetadata,
        customMetadata: meta.customMetadata,
        body: stream,
        bodyUsed: false,
        async arrayBuffer() {
          return uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
        },
        async text() {
          return buffer.toString("utf-8");
        },
      };
    },

    async put(key: string, value, options?: R2PutOptions): Promise<R2Object | null> {
      const { dataPath, metaPath, cleanKey } = resolveSafe(key);
      fs.mkdirSync(path.dirname(dataPath), { recursive: true });
      let buf: Buffer;
      if (value instanceof ArrayBuffer) {
        buf = Buffer.from(new Uint8Array(value));
      } else if (ArrayBuffer.isView(value)) {
        buf = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
      } else if (typeof value === "string") {
        buf = Buffer.from(value, "utf-8");
      } else if (value instanceof Blob) {
        buf = Buffer.from(new Uint8Array(await value.arrayBuffer()));
      } else {
        const reader = (value as ReadableStream<Uint8Array>).getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          if (chunk) chunks.push(chunk);
        }
        buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
      }
      fs.writeFileSync(dataPath, buf);
      const uploadedAt = new Date().toISOString();
      const etag = `"${buf.byteLength}-${Date.now()}"`;
      const meta: StoredSidecarMeta = {
        size: buf.byteLength,
        etag,
        uploaded: uploadedAt,
        httpMetadata: options?.httpMetadata,
        customMetadata: options?.customMetadata,
      };
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");
      return {
        key: cleanKey,
        version: "local-v1",
        size: buf.byteLength,
        etag: etag.replace(/"/g, ""),
        httpEtag: etag,
        uploaded: new Date(uploadedAt),
        httpMetadata: options?.httpMetadata,
        customMetadata: options?.customMetadata,
      };
    },

    async delete(keys: string | string[]): Promise<void> {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) {
        const { dataPath, metaPath } = resolveSafe(k);
        if (fs.existsSync(dataPath)) fs.unlinkSync(dataPath);
        if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
      }
    },

    async list(options?: R2ListOptions): Promise<R2Objects> {
      const limit = options?.limit ?? 100;
      const prefix = (options?.prefix || "").replace(/^\/+/, "");
      const results: R2Object[] = [];

      const walk = (dir: string) => {
        if (!fs.existsSync(dir) || results.length >= limit) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (results.length >= limit) break;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
          } else if (!entry.name.endsWith(".__r2meta.json")) {
            const rel = path.relative(rootDir, full).replace(/\\/g, "/");
            if (prefix && !rel.startsWith(prefix)) continue;
            const meta = readMeta(`${full}.__r2meta.json`, full);
            if (meta) {
              results.push({
                key: rel,
                version: "local-v1",
                size: meta.size,
                etag: meta.etag.replace(/"/g, ""),
                httpEtag: meta.etag,
                uploaded: new Date(meta.uploaded),
                httpMetadata: meta.httpMetadata,
                customMetadata: meta.customMetadata,
              });
            }
          }
        }
      };

      walk(rootDir);
      return { objects: results, truncated: false };
    },
  };
}

async function expressReqToWebRequest(req: ExpressRequest): Promise<Request> {
  const host = req.headers.host || "localhost:3000";
  const proto = req.protocol || "http";
  const url = `${proto}://${host}${req.originalUrl}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) {
      v.forEach((item) => headers.append(k, item));
    } else if (typeof v === "string") {
      headers.set(k, v);
    }
  }

  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return new Request(url, { method, headers });
  }

  let bodyBuffer: Buffer;
  if (Buffer.isBuffer(req.body)) {
    bodyBuffer = req.body;
  } else if (req.body && typeof req.body === "object" && Object.keys(req.body).length > 0) {
    bodyBuffer = Buffer.from(JSON.stringify(req.body), "utf-8");
  } else {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    bodyBuffer = Buffer.concat(chunks);
  }

  const bodyArrayBuffer = bodyBuffer.buffer.slice(
    bodyBuffer.byteOffset,
    bodyBuffer.byteOffset + bodyBuffer.byteLength
  ) as ArrayBuffer;

  return new Request(url, {
    method,
    headers,
    body: bodyArrayBuffer,
  });
}

async function sendWebResponse(res: ExpressResponse, webRes: Response): Promise<void> {
  res.status(webRes.status);
  webRes.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  if (!webRes.body) {
    res.end();
    return;
  }
  const ab = await webRes.arrayBuffer();
  res.send(Buffer.from(ab));
}

export function registerLocalR2Routes(app: Express, baseDir: string): void {
  const r2Root = path.resolve(baseDir, ".r2-local");
  const env: StorageEnv = {
    R2_PUBLIC: createDiskR2Bucket(path.join(r2Root, "public")),
    R2_PRIVATE: createDiskR2Bucket(path.join(r2Root, "private")),
    PUBLIC_R2_CDN_URL: process.env.PUBLIC_R2_CDN_URL || "",
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "smartnoakhali-f38e9",
    R2_ALLOWED_ORIGINS: process.env.R2_ALLOWED_ORIGINS || "",
  };

  app.options("/api/health", async (req, res) => {
    await sendWebResponse(res, await healthFn.onRequestOptions({ request: await expressReqToWebRequest(req), env }));
  });
  app.get("/api/health", async (req, res) => {
    await sendWebResponse(res, await healthFn.onRequestGet({ request: await expressReqToWebRequest(req), env }));
  });

  app.options("/api/storage/health", async (req, res) => {
    await sendWebResponse(res, await healthFn.onRequestOptions({ request: await expressReqToWebRequest(req), env }));
  });
  app.get("/api/storage/health", async (req, res) => {
    await sendWebResponse(res, await healthFn.onRequestGet({ request: await expressReqToWebRequest(req), env }));
  });

  app.options("/api/storage/upload", async (req, res) => {
    await sendWebResponse(res, await uploadFn.onRequestOptions({ request: await expressReqToWebRequest(req), env }));
  });
  app.post("/api/storage/upload", async (req, res) => {
    await sendWebResponse(res, await uploadFn.onRequestPost({ request: await expressReqToWebRequest(req), env }));
  });

  app.options("/api/storage/migrate", async (req, res) => {
    await sendWebResponse(res, await migrateFn.onRequestOptions({ request: await expressReqToWebRequest(req), env }));
  });
  app.post("/api/storage/migrate", async (req, res) => {
    await sendWebResponse(res, await migrateFn.onRequestPost({ request: await expressReqToWebRequest(req), env }));
  });

  const handleFileRoute = async (req: ExpressRequest, res: ExpressResponse) => {
    const webReq = await expressReqToWebRequest(req);
    const rel = req.path.replace(/^\/api\/storage\/file\/?/, "");
    const pathArr = rel.split("/").filter(Boolean);
    const ctx = { request: webReq, env, params: { path: pathArr } };
    if (req.method === "OPTIONS") {
      await sendWebResponse(res, await fileFn.onRequestOptions(ctx));
    } else if (req.method === "HEAD") {
      await sendWebResponse(res, await fileFn.onRequestHead(ctx));
    } else if (req.method === "PUT") {
      await sendWebResponse(res, await fileFn.onRequestPut(ctx));
    } else if (req.method === "PATCH") {
      await sendWebResponse(res, await fileFn.onRequestPatch(ctx));
    } else if (req.method === "DELETE") {
      await sendWebResponse(res, await fileFn.onRequestDelete(ctx));
    } else {
      await sendWebResponse(res, await fileFn.onRequestGet(ctx));
    }
  };

  app.options("/api/storage/file/*", handleFileRoute);
  app.head("/api/storage/file/*", handleFileRoute);
  app.get("/api/storage/file/*", handleFileRoute);
  app.put("/api/storage/file/*", handleFileRoute);
  app.patch("/api/storage/file/*", handleFileRoute);
  app.delete("/api/storage/file/*", handleFileRoute);
}
