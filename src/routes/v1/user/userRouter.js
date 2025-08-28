import { Router } from "express";
import {
  changeUserPassword,
  checkPasswordStatus,
  deleteUser,
  getDonors,
  getUser,
  registerUser,
  setPassword,
  updateUser,
  userLogin,
} from "../../../controllers/user/userController.js";
import { profilePicUpload } from "../../../utils/multerConfig.js";
import { authenticate } from "../../../middleware/authMiddleware.js";

const userRouter = Router();

userRouter.post("/login", userLogin);
userRouter.post(
  "/register",
  profilePicUpload.single("profilePic"),
  registerUser
);
userRouter.post("/set-password", setPassword);
userRouter.get("/password-status", checkPasswordStatus);

userRouter.use(authenticate);

userRouter.put("/change-password", changeUserPassword);
userRouter.get("/get", getUser);
userRouter.put("/update", profilePicUpload.single("profilePic"), updateUser);
userRouter.delete("/delete", deleteUser);

userRouter.get("/get-donors", getDonors);

export default userRouter;
