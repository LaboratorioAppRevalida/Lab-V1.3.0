import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// ── 404 catch-all ─────────────────────────────────────────────────────────────
// Matches any request that fell through all routes — always returns JSON so the
// frontend never receives an HTML "Not Found" page.
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// ── Global error handler ──────────────────────────────────────────────────────
// Express requires exactly 4 arguments to recognise this as an error handler.
// Catches any unhandled exception from route handlers and returns JSON so the
// frontend never receives an HTML error page.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err: err?.message ?? String(err) }, "[app] unhandled error");
  if (res.headersSent) return;
  res.status(500).json({ error: err?.message ?? "Internal server error" });
});

export default app;
