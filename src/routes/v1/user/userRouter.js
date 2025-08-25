import { Router } from "express";
import {
  deleteUser,
  getUser,
  registerUser,
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

userRouter.use(authenticate);

userRouter.get("/get", getUser);
userRouter.put("/update", profilePicUpload.single("profilePic"), updateUser);
userRouter.delete("/delete", deleteUser);

export default userRouter;
