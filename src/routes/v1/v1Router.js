import { Router } from "express";
import publicRouter from "./public/publicRouter.js";
import adminRouter from "./admin/adminRouter.js";
import userRouter from "./user/userRouter.js";

const v1Router = Router();

v1Router.use("/public", publicRouter);
v1Router.use("/admin", adminRouter);
v1Router.use("/user", userRouter);

export default v1Router;
