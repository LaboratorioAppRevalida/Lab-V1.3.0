import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import pkg from "../../package.json" with { type: "json" };

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: pkg.version,
  });
  res.json(data);
});

export default router;
