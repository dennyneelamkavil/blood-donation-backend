import { Router } from "express";

const publicRouter = Router();

// Test route
publicRouter.get("/test", (req, res) => {
  res.json({
    message: "Test route is working!",
    timestamp: new Date().toISOString(),
    version: "v1",
    buildTag: "migrate user system to Google-based authentication and remove password flow",
  });
});

export default publicRouter;
