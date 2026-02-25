import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import agentRoutes from "./routes/agent";
import devserverRoutes from "./routes/devserver";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Mount API routes
app.route("/", agentRoutes);
app.route("/", devserverRoutes);

// Serve built web assets in production (API routes take priority above)
app.use("*", serveStatic({ root: "./web/dist" }));
app.use("*", serveStatic({ root: "./web/dist", path: "index.html" }));

const port = Number(process.env.PORT) || 3847;

console.log(`Claude Code Container Agent server listening on http://0.0.0.0:${port}`);
console.log(`Web app: http://localhost:${port}`);

export default {
  port,
  hostname: "0.0.0.0",
  idleTimeout: 0, // disable — SSE streams can be long-lived
  fetch: app.fetch,
};
