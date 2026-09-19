import { Router } from "express";

const router = Router();

router.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "ai-content-analyzer-backend",
    time: new Date().toISOString(),
  });
});

export default router;
