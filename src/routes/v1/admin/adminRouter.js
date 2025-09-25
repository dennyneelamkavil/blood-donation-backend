import { Router } from "express";
import multer from "multer";
import {
  adminLogin,
  changeAdminPassword,
  createUser,
  deleteUserById,
  getCurrentAdmin,
  getDashboardData,
  getUserById,
  getUsers,
  updateUserById,
} from "../../../controllers/admin/adminController.js";
import { importUsersFromExcel } from "../../../controllers/admin/importController.js";
import { seedAdmin } from "../../../utils/adminSeeder.js";
import { authenticate } from "../../../middleware/authMiddleware.js";
import { profilePicUpload } from "../../../utils/multerConfig.js";

const adminRouter = Router();

const upload = multer({ dest: "tmp/uploads" });

// Seed default admin - "admin"
// seedAdmin();

adminRouter.post("/login", adminLogin);

adminRouter.use(authenticate);

adminRouter.get("/get", getCurrentAdmin);
adminRouter.get("/dashboard", getDashboardData);
adminRouter.get("/get-users", getUsers);
adminRouter.get("/get-user/:userId", getUserById);
adminRouter.post(
  "/create-user",
  profilePicUpload.single("profilePic"),
  createUser
);
adminRouter.put(
  "/update-user/:userId",
  profilePicUpload.single("profilePic"),
  updateUserById
);
adminRouter.delete("/delete-user/:userId", deleteUserById);

adminRouter.put("/change-password", changeAdminPassword);

adminRouter.post("/import-users", upload.single("file"), importUsersFromExcel);

export default adminRouter;
