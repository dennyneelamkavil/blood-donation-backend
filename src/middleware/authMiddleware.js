import jwt from "jsonwebtoken";
import AdminModel from "../models/adminModel.js";
import UserModel from "../models/userModel.js";

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Token missing or malformed" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Example payload: { id: "userId", type: "admin" | "user" }
    if (decoded.type === "admin") {
      const admin = await AdminModel.findById(decoded.id);
      if (!admin) return res.status(401).json({ message: "Admin not found" });
      req.admin = admin;
      req.user = null;
    } else if (decoded.type === "user") {
      const user = await UserModel.findById(decoded.id);
      if (!user) return res.status(401).json({ message: "User not found" });
      req.user = user;
      req.admin = null;
    } else {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    }
    next(err);
  }
};
