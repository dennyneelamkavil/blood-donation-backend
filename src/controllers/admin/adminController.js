import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import AdminModel from "../../models/adminModel.js";
import UserModel from "../../models/userModel.js";
import mongoose from "mongoose";

export async function adminLogin(req, res, next) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username and password are required" });
    }

    const admin = await AdminModel.findOne({ username });
    if (admin) {
      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch)
        return res.status(401).json({ message: "Invalid credentials" });

      const token = jwt.sign(
        { id: admin._id, type: "admin" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.status(200).json({
        token,
        role: "admin",
        type: "admin",
        message: "Admin login successful",
      });
    }

    return res.status(401).json({ message: "Invalid credentials" });
  } catch (err) {
    next(err);
  }
}

export async function getCurrentAdmin(req, res, next) {
  try {
    if (!req.admin) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const adminId = req.admin._id;
    const admin = await AdminModel.findById(adminId)
      .select("-__v -password -createdAt -updatedAt")
      .lean();

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    return res.status(200).json({ admin });
  } catch (err) {
    next(err);
  }
}
export async function getDashboardData(req, res, next) {
  try {
    const userCount = await UserModel.countDocuments();

    return res.status(200).json({
      userCount,
    });
  } catch (err) {
    next(err);
  }
}

export async function getUsers(req, res, next) {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const sortOrder = req.query.sortOrder || "latest";
    // Ensure page and limit are >= 1
    page = page < 1 ? 1 : page;
    limit = limit < 1 ? 10 : limit;

    const query = {
      $or: [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ],
    };
    const sortSpec = {};
    switch (sortOrder) {
      case "oldest":
        sortSpec.createdAt = 1;
        break;
      case "latest":
        sortSpec.createdAt = -1;
        break;
      case "nameAsc":
        sortSpec.name = 1;
        break;
      case "nameDesc":
        sortSpec.name = -1;
        break;
      default:
        sortSpec.createdAt = -1;
    }
    const users = await UserModel.find(query)
      .select("-__v -password")
      .collation({ locale: "en", strength: 2 }) // Case-insensitive sorting
      .sort(sortSpec)
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await UserModel.countDocuments({ isDeleted: false });
    const filteredCount = await UserModel.countDocuments(query);
    const totalPages = Math.ceil(filteredCount / limit);

    return res.status(200).json({
      total,
      filteredCount,
      page,
      totalPages,
      limit,
      users,
    });
  } catch (err) {
    next(err);
  }
}

export async function getUser(req, res, next) {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const user = await UserModel.findOne({
      _id: userId,
      isDeleted: false,
    }).select("-__v -password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const deleted = await UserModel.findByIdAndDelete(userId);
    if (!deleted) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    next(err);
  }
}

export async function changeAdminPassword(req, res, next) {
  try {
    if (!req.admin) {
      return res.status(401).json({ message: "Not authorized" });
    }
    const admin = await AdminModel.findById(req.admin._id);
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Missing current or new password" });
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid current password" });
    }

    admin.password = await bcrypt.hash(newPassword, 10);
    await admin.save();
    return res.status(200).json({ message: "Password changed successfully" });
  } catch (err) {
    next(err);
  }
}
