import { Router } from "express";
import {
  adminLogin,
  changePassword,
  deleteUser,
  getCurrentAdmin,
  getDashboardData,
  getUser,
  getUsers,
} from "../../../controllers/admin/adminController.js";
import { seedAdmin } from "../../../utils/adminSeeder.js";
import { authenticate } from "../../../middleware/authMiddleware.js";

const adminRouter = Router();

// Seed default admin - "admin"
// seedAdmin();

adminRouter.post("/login", adminLogin);

adminRouter.use(authenticate);

adminRouter.get("/get", getCurrentAdmin);
adminRouter.get("/dashboard", getDashboardData);
adminRouter.get("/get-users", getUsers);
adminRouter.get("/get-user/:userId", getUser);
adminRouter.delete("/delete-user/:userId", deleteUser);

adminRouter.put("/change-password", changePassword);

export default adminRouter;
