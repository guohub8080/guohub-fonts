#!/usr/bin/env node
/**
 * 把 git 跟踪的全部产物上传到 R2（桶 guohub-assets 的 font/ 前缀），对外经
 * 自定义域名 assets.guohub.top/font/ 提供，是 webfontLoader 的首选 CDN 源。
 *
 *   node scripts/upload-r2.mjs            # 增量上传（sha1 清单，只传变化文件）
 *   node scripts/upload-r2.mjs --all      # 无视清单全量重传
 *   node scripts/upload-r2.mjs --dry-run  # 只列出会上传的文件
 *
 * 前置：wrangler 已登录（npx wrangler@4.133.0 login，OAuth 即可）。零依赖。
 * 仓库规矩：直接 node 执行，勿用 pnpm run（依赖预检 OOM，见 AGENTS.md 坑 2）。
 *
 * 缓存语义与 _headers（Pages 层）对齐：
 *   woff2/css → public, max-age=86400（不用 immutable：CJK 分片名不带哈希，
 *               重新分片后同名文件内容会变，一天是新鲜度与零协商请求的折中）
 *   其余      → public, max-age=600（index.html / families.json 新鲜度优先）
 *
 * .r2-manifest.json（gitignore）记录每个文件的 sha1，只上传变化过的对象；
 * 失败的文件不记入清单，重跑本脚本自动续传。仓库中删除的文件不从桶里删
 * （留旧无害，如需清理用 wrangler r2 object delete）。
 */

import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BUCKET = "guohub-assets";
const PREFIX = "font"; // 桶内前缀 → https://assets.guohub.top/font/...
const MANIFEST = path.join(ROOT, ".r2-manifest.json");
const CONCURRENCY = 8;
const WRANGLER = ["npx", "--yes", "wrangler@4.133.0"];

function cacheControlFor(file) {
  return /\.(woff2?|css)$/.test(file)
    ? "public, max-age=86400"
    : "public, max-age=600";
}

const CONTENT_TYPES = {
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

function listFiles() {
  const out = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT });
  return out.toString().split("\0").filter(Boolean);
}

function sha1(file) {
  return createHash("sha1").update(fs.readFileSync(file)).digest("hex");
}

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  } catch {
    return {};
  }
}

function upload(rel, abs) {
  const args = [
    ...WRANGLER,
    "r2",
    "object",
    "put",
    `${BUCKET}/${PREFIX}/${rel}`,
    "--file",
    abs,
    "--remote",
    "--cache-control",
    cacheControlFor(rel),
  ];
  const ct = CONTENT_TYPES[path.extname(rel).toLowerCase()];
  if (ct) args.push("--content-type", ct);
  return new Promise((resolve) => {
    const p = spawn(args[0], args.slice(1), { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => resolve(String(e)));
    p.on("close", (code) => resolve(code === 0 ? null : err.slice(-400)));
  });
}

async function uploadWithRetry(rel, abs, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    const err = await upload(rel, abs);
    if (!err) return null;
    if (i === tries) return err;
    await new Promise((r) => setTimeout(r, 1500 * i));
  }
}

const forceAll = process.argv.includes("--all");
const dryRun = process.argv.includes("--dry-run");

const files = listFiles();
const manifest = forceAll ? {} : readManifest();
const todo = [];
for (const rel of files) {
  const sum = sha1(path.join(ROOT, rel));
  if (manifest[rel] === sum) continue;
  todo.push([rel, path.join(ROOT, rel), sum]);
}

console.log(
  `git 产物 ${files.length} 个，本次待上传 ${todo.length} 个（${forceAll ? "--all 全量" : "清单增量"}）`,
);
if (dryRun) {
  for (const [rel] of todo) console.log(`  ${rel}`);
  process.exit(0);
}
if (todo.length === 0) process.exit(0);

const queue = [...todo];
const nextManifest = { ...manifest };
const failed = [];
let done = 0;

async function worker() {
  for (;;) {
    const item = queue.shift();
    if (item === undefined) return;
    const [rel, abs, sum] = item;
    const err = await uploadWithRetry(rel, abs);
    if (err) {
      failed.push(rel);
      console.error(`✗ ${rel}\n${err}`);
    } else {
      nextManifest[rel] = sum;
    }
    done++;
    if (done % 50 === 0 || done === todo.length) console.log(`… ${done}/${todo.length}`);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

fs.writeFileSync(MANIFEST, JSON.stringify(nextManifest, null, 2) + "\n");

if (failed.length) {
  console.error(`完成 ${done - failed.length}/${todo.length}，失败 ${failed.length} —— 重跑本脚本自动续传`);
  process.exit(1);
}
console.log(`全部完成：${todo.length} 个对象 → r2://${BUCKET}/${PREFIX}/`);
