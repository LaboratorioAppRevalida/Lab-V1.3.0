import { Router, type IRouter } from "express";
import healthRouter from "./health";
import livekitTokenRouter from "./livekit-token";
import asaasWebhookRouter from "./asaas-webhook";
import asaasCheckoutRouter from "./asaas-checkout";
import subscriptionStatusRouter from "./subscription-status";

const router: IRouter = Router();

router.use(healthRouter);
router.use(livekitTokenRouter);
router.use(asaasWebhookRouter);
router.use(asaasCheckoutRouter);
router.use(subscriptionStatusRouter);

export default router;
