import { Router, type IRouter } from "express";
import { AccessToken } from "livekit-server-sdk";

const router: IRouter = Router();

router.post("/livekit-token", async (req, res) => {
  const livekitUrl = process.env["LIVEKIT_URL"];
  const apiKey = process.env["LIVEKIT_API_KEY"];
  const apiSecret = process.env["LIVEKIT_API_SECRET"];

  if (!livekitUrl || !apiKey || !apiSecret) {
    res.status(503).json({ error: "LiveKit not configured" });
    return;
  }

  const { roomName, participantName } = req.body as {
    roomName?: string;
    participantName?: string;
  };

  if (!roomName || typeof roomName !== "string" || roomName.trim() === "") {
    res.status(400).json({ error: "roomName is required" });
    return;
  }

  if (!participantName || typeof participantName !== "string" || participantName.trim() === "") {
    res.status(400).json({ error: "participantName is required" });
    return;
  }

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName.trim(),
      ttl: 7200, // 2 hours
    });

    at.addGrant({
      room: roomName.trim(),
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();
    res.json({ token, url: livekitUrl });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate token" });
  }
});

export default router;
