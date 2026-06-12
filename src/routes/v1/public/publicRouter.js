import { Router } from "express";

const publicRouter = Router();

// Test route
publicRouter.get("/test", (req, res) => {
  res.json({
    message: "Test route is working!",
    timestamp: new Date().toISOString(),
    version: "v1",
    buildTag: "add proof document upload API",
  });
});

export default publicRouter;
