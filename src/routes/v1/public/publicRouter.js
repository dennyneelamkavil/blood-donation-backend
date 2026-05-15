import { Router } from "express";

const publicRouter = Router();

// Test route
publicRouter.get("/test", (req, res) => {
  res.json({
    message: "Test route is working!",
    timestamp: new Date().toISOString(),
    version: "v1",
    buildTag: "filter eligible donors by donation cooldown period",
  });
});

export default publicRouter;
