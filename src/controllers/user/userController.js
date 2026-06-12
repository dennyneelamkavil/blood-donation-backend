import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";
import UserModel from "../../models/userModel.js";
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const VALID_BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const VALID_GENDERS = ["male", "female", "other"];

export async function googleLogin(req, res, next) {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: "idToken required" });
    }

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name;
    const profilePic = payload.picture;

    let user = await UserModel.findOne({
      $or: [{ googleId }, { email }],
    });

    if (!user) {
      user = new UserModel({
        googleId,
        email,
        name,
        profilePic,
        lastLogin: Date.now(),
      });
    } else {
      // ✅ Sync latest Google info
      user.googleId = googleId;
      user.name = name || user.name;
      user.profilePic = profilePic || user.profilePic;
      user.lastLogin = Date.now();
    }

    await user.save();

    const token = jwt.sign(
      { id: user._id, type: "user" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.status(200).json({
      token,
      isProfileComplete: user.isProfileComplete,
      message: "Google login successful",
    });
  } catch (err) {
    next(err);
  }
}

export async function completeProfile(req, res, next) {
  try {
    const userId = req.user._id;

    const { phone, bloodGroup, place } = req.body;

    if (!phone || !bloodGroup) {
      return res.status(400).json({
        message: "phone and bloodGroup are required",
      });
    }

    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        message: "Phone must be 10 digits",
      });
    }

    if (!VALID_BLOOD_GROUPS.includes(bloodGroup)) {
      return res.status(400).json({
        message: "Invalid blood group",
      });
    }

    // Check phone uniqueness
    const existing = await UserModel.findOne({
      phone,
      _id: { $ne: userId },
    });

    if (existing) {
      return res.status(400).json({
        message: "Phone already in use",
      });
    }

    const user = await UserModel.findByIdAndUpdate(
      userId,
      {
        phone,
        bloodGroup,
        place,
        isProfileComplete: true,
      },
      { new: true },
    );

    return res.status(200).json({
      message: "Profile completed",
      user,
    });
  } catch (err) {
    next(err);
  }
}

export async function getUser(req, res, next) {
  try {
    const userId = req.user._id;
    const user = await UserModel.findOne({
      _id: userId,
    }).select("-__v -createdAt -updatedAt");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user });
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
      address,
      place,
      bloodGroup,
      isDonor,
      lastDonationDate,
    } = req.body;

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // validations
    if (phone && !/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        message: "Phone number must be exactly 10 digits",
      });
    }

    if (phone && phone !== user.phone) {
      const existingUser = await UserModel.findOne({
        phone,
        _id: { $ne: userId },
      });
      if (existingUser) {
        return res.status(400).json({
          message: "Phone number already in use",
        });
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
    if (address) updateData.address = address;
    if (place) updateData.place = place;
    if (typeof isDonor !== "undefined") updateData.isDonor = isDonor;
    if (bloodGroup) updateData.bloodGroup = bloodGroup;
    if (lastDonationDate)
      updateData.lastDonationDate = new Date(lastDonationDate);

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
    }).select("-__v -createdAt -updatedAt");

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
    if (deleted.profilePic) {
      const oldImagePath = path.join(process.cwd(), deleted.profilePic);
      fs.unlink(oldImagePath, (err) => {
        if (err) console.warn("Failed to delete old image:", err.message);
      });
    }
    if (deleted.proofFront) {
      const frontPath = path.join(process.cwd(), deleted.proofFront);
      fs.unlink(frontPath, (err) => {
        if (err) {
          console.warn("Failed to delete proof front:", err.message);
        }
      });
    }
    if (deleted.proofBack) {
      const backPath = path.join(process.cwd(), deleted.proofBack);
      fs.unlink(backPath, (err) => {
        if (err) {
          console.warn("Failed to delete proof back:", err.message);
        }
      });
    }

    return res.status(200).json({ message: "User deleted successfully" });
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
    const bloodGroup = req.query.bloodGroup || "";
    // Ensure page and limit are >= 1
    page = page < 1 ? 1 : page;
    limit = limit < 1 ? 10 : limit;

    // Dates for eligibility
    const now = new Date();

    const maleEligibleDate = new Date(now);
    maleEligibleDate.setDate(now.getDate() - 90);

    const femaleEligibleDate = new Date(now);
    femaleEligibleDate.setDate(now.getDate() - 120);

    const query = {
      isDonor: true,

      $or: [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ],

      // Donation eligibility filter
      $and: [
        {
          $or: [
            // Never donated before
            { lastDonationDate: { $exists: false } },
            { lastDonationDate: null },

            // Male donors after 90 days
            {
              gender: "male",
              lastDonationDate: { $lte: maleEligibleDate },
            },

            // Female donors after 120 days
            {
              gender: "female",
              lastDonationDate: { $lte: femaleEligibleDate },
            },

            // Optional: include "other"
            {
              gender: "other",
              lastDonationDate: { $lte: maleEligibleDate },
            },
          ],
        },
      ],
    };

    if (bloodGroup && !VALID_BLOOD_GROUPS.includes(bloodGroup)) {
      return res.status(400).json({ message: "Invalid blood group filter" });
    }
    if (bloodGroup) {
      query.bloodGroup = bloodGroup;
    }

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
      .select("-__v -lastLogin -createdAt -updatedAt")
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

export async function uploadProof(req, res, next) {
  try {
    const userId = req.user._id;

    if (!req.files?.proofFront?.[0] && !req.files?.proofBack?.[0]) {
      return res.status(400).json({
        message: "No files uploaded",
      });
    }

    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const updateData = {};

    if (req.files?.proofFront?.[0]) {
      if (user.proofFront) {
        const oldPath = path.join(process.cwd(), user.proofFront);

        fs.unlink(oldPath, (err) => {
          if (err) {
            console.warn("Failed to delete old proof front:", err.message);
          }
        });
      }

      updateData.proofFront = `/public/images/proofs/${req.files.proofFront[0].filename}`;
    }

    if (req.files?.proofBack?.[0]) {
      if (user.proofBack) {
        const oldPath = path.join(process.cwd(), user.proofBack);

        fs.unlink(oldPath, (err) => {
          if (err) {
            console.warn("Failed to delete old proof back:", err.message);
          }
        });
      }

      updateData.proofBack = `/public/images/proofs/${req.files.proofBack[0].filename}`;
    }

    const updatedUser = await UserModel.findByIdAndUpdate(userId, updateData, {
      new: true,
    }).select("-__v -createdAt -updatedAt");

    return res.status(200).json({
      message: "Proof uploaded successfully",
      user: updatedUser,
    });
  } catch (err) {
    next(err);
  }
}
