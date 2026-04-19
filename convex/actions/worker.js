"use node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

const WORKER_URL = process.env.WORKER_VPS_URL ?? "http://localhost:3200";
const WORKER_SECRET = process.env.WORKER_API_SECRET ?? "";

async function workerFetch(path, body) {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WORKER_SECRET}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error(`workerFetch ${path} returned non-JSON (status ${res.status}):`, text.slice(0, 200));
    return { status: "error", error: `Non-JSON response from worker: ${text.slice(0, 100)}` };
  }
}
