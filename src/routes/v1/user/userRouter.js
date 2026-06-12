import { Router } from "express";
import {
  completeProfile,
  deleteUser,
  getDonors,
  getUser,
  googleLogin,
  updateUser,
  uploadProof,
} from "../../../controllers/user/userController.js";
import { profilePicUpload, proofUpload } from "../../../utils/multerConfig.js";
import { authenticate } from "../../../middleware/authMiddleware.js";

const userRouter = Router();

userRouter.post("/google-login", googleLogin);
userRouter.post("/google-complete-profile", authenticate, completeProfile);

userRouter.use(authenticate);

userRouter.get("/get", getUser);
userRouter.put("/update", profilePicUpload.single("profilePic"), updateUser);
userRouter.delete("/delete", deleteUser);

userRouter.put(
  "/upload-proof",
  proofUpload.fields([
    { name: "proofFront", maxCount: 1 },
    { name: "proofBack", maxCount: 1 },
  ]),
  uploadProof,
);

userRouter.get("/get-donors", getDonors);

export default userRouter;
