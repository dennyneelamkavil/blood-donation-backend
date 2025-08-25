import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";
import UserModel from "../../models/userModel.js";
import mongoose from "mongoose";

const VALID_BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const VALID_GENDERS = ["male", "female", "other"];

export async function userLogin(req, res, next) {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res
        .status(400)
        .json({ message: "Phone number and password are required" });
    }

    const user = await UserModel.findOne({ phone });
    if (user) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch)
        return res.status(401).json({ message: "Invalid credentials" });

      const token = jwt.sign(
        { id: user._id, type: "user" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.status(200).json({
        token,
        role: "user",
        type: "user",
        message: "User login successful",
      });
    }

    return res.status(401).json({ message: "Invalid credentials" });
  } catch (err) {
    next(err);
  }
}

export async function registerUser(req, res, next) {
  try {
    const {
      phone,
      name,
      password,
      place,
      dateOfBirth,
      gender,
      bloodGroup,
      isDonor,
      lastDonationDate,
    } = req.body;

    if (!phone || !name || !bloodGroup) {
      return res
        .status(400)
        .json({ message: "phone, name and blood group are required" });
    }

    if (!/^\d{10}$/.test(phone)) {
      return res
        .status(400)
        .json({ message: "Phone number must be exactly 10 digits" });
    }

    if (!VALID_BLOOD_GROUPS.includes(bloodGroup)) {
      return res.status(400).json({ message: "Invalid blood group" });
    }

    if (gender && !VALID_GENDERS.includes(gender)) {
      return res.status(400).json({ message: "Invalid gender" });
    }

    // check existing user
    const existing = await UserModel.findOne({ phone });
    if (existing) {
      return res
        .status(400)
        .json({ message: "User with this phone already exists" });
    }

    // build user object
    const newUserData = {
      phone,
      name,
      place: place || undefined,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      gender: gender || undefined,
      bloodGroup,
      isDonor: typeof isDonor !== "undefined" ? !!isDonor : false,
      lastDonationDate: lastDonationDate
        ? new Date(lastDonationDate)
        : undefined,
      lastLogin: Date.now(),
    };

    if (req.file) {
      newUserData.profilePic = `/public/images/profilepics/${req.file.filename}`;
    }

    if (password) {
      const saltRounds = 10;
      newUserData.password = await bcrypt.hash(password, saltRounds);
    }

    const user = new UserModel(newUserData);
    await user.save();

    const token = jwt.sign(
      { id: user._id, type: "user" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      token,
      role: "user",
      type: "user",
      message: "User registered successfully",
    });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req, res, next) {
  try {
    const userId = req.user && req.user._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      name,
      dateOfBirth,
      gender,
      phone,
      place,
      bloodGroup,
      isDonor,
      lastDonationDate,
      password,
    } = req.body;

    const user = await UserModel.findById(userId).select("+password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // validations
    if (phone && !/^\d{10}$/.test(phone)) {
      return res
        .status(400)
        .json({ message: "Phone number must be exactly 10 digits" });
    }

    if (phone && phone !== user.phone) {
      const existingUser = await UserModel.findOne({
        phone,
        _id: { $ne: userId },
      });
      if (existingUser) {
        return res.status(400).json({ message: "Phone number already in use" });
      }
    }

    if (gender && !VALID_GENDERS.includes(gender)) {
      return res.status(400).json({ message: "Invalid gender" });
    }

    if (bloodGroup && !VALID_BLOOD_GROUPS.includes(bloodGroup)) {
      return res.status(400).json({ message: "Invalid bloodGroup" });
    }

    const updateData = {};
    if (phone) updateData.phone = phone;
    if (name) updateData.name = name;
    if (dateOfBirth) updateData.dateOfBirth = new Date(dateOfBirth);
    if (gender) updateData.gender = gender;
    if (place) updateData.place = place;
    if (typeof isDonor !== "undefined") updateData.isDonor = !!isDonor;
    if (bloodGroup) updateData.bloodGroup = bloodGroup;
    if (lastDonationDate)
      updateData.lastDonationDate = new Date(lastDonationDate);

    if (password) {
      const saltRounds = 10;
      updateData.password = await bcrypt.hash(password, saltRounds);
    }

    if (req.file) {
      // Delete old image if it exists
      if (user.profilePic) {
        const oldImagePath = path.join(process.cwd(), user.profilePic);
        fs.unlink(oldImagePath, (err) => {
          if (err) console.warn("Failed to delete old image:", err.message);
        });
      }
      // Set new image path
      updateData.profilePic = `/public/images/profilepics/${req.file.filename}`;
    }

    const updatedUser = await UserModel.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    }).select("-__v -password");

    return res.status(200).json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const userId = req.user._id;
    const deleted = await UserModel.findByIdAndDelete(userId);
    if (!deleted) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    next(err);
  }
}

export async function getUser(req, res, next) {
  try {
    const userId = req.user._id;
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

export async function getDonors(req, res, next) {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const sortOrder = req.query.sortOrder || "latest";
    // Ensure page and limit are >= 1
    page = page < 1 ? 1 : page;
    limit = limit < 1 ? 10 : limit;

    const query = {
      isDonor: true,
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
    const donors = await UserModel.find(query)
      .select("-__v -password -lastLogin -createdAt -updatedAt")
      .collation({ locale: "en", strength: 2 }) // Case-insensitive sorting
      .sort(sortSpec)
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await UserModel.countDocuments({ isDonor: true });
    const filteredCount = await UserModel.countDocuments(query);
    const totalPages = Math.ceil(filteredCount / limit);

    return res.status(200).json({
      total,
      filteredCount,
      page,
      totalPages,
      limit,
      donors,
    });
  } catch (err) {
    next(err);
  }
}
