import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";
import xlsx from "xlsx";
import AdminModel from "../../models/adminModel.js";
import UserModel from "../../models/userModel.js";
import mongoose from "mongoose";

const VALID_BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const VALID_GENDERS = ["male", "female", "other"];

const ACCEPTED_HEADERS = [
  "phone", // required (10 digits)
  "name", // required
  "address", // optional
  "place", // optional
  "dateOfBirth", // optional (YYYY-MM-DD)
  "gender", // optional (male|female|other)
  "bloodGroup", // required (A+/A-/B+/B-/AB+/AB-/O+/O-)
  "isDonor", // optional (true/false)
  "lastDonationDate", // optional (YYYY-MM-DD)
];

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
    const donorCount = await UserModel.countDocuments({ isDonor: true });

    return res.status(200).json({
      userCount,
      donorCount,
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
    const bloodGroup = req.query.bloodGroup || "";
    // Ensure page and limit are >= 1
    page = page < 1 ? 1 : page;
    limit = limit < 1 ? 10 : limit;

    const query = {
      $or: [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
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
      case "donorsFirst":
        sortSpec.isDonor = -1;
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

    const total = await UserModel.countDocuments();
    const donorCount = await UserModel.countDocuments({ isDonor: true });
    const filteredCount = await UserModel.countDocuments(query);
    const totalPages = Math.ceil(filteredCount / limit);

    return res.status(200).json({
      total,
      donorCount,
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

export async function getUserById(req, res, next) {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const user = await UserModel.findOne({
      _id: userId,
    }).select("-__v -password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

export async function createUser(req, res, next) {
  try {
    const {
      phone,
      name,
      password,
      address,
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
      address: address || undefined,
      place: place || undefined,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      gender: gender || undefined,
      bloodGroup,
      isDonor: typeof isDonor !== "undefined" ? isDonor : false,
      lastDonationDate: lastDonationDate
        ? new Date(lastDonationDate)
        : undefined,
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

export async function updateUserById(req, res, next) {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
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
    if (address) updateData.address = address;
    if (place) updateData.place = place;
    if (typeof isDonor !== "undefined") updateData.isDonor = isDonor;
    if (bloodGroup) updateData.bloodGroup = bloodGroup;
    if (lastDonationDate)
      updateData.lastDonationDate = new Date(lastDonationDate);

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
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

export async function deleteUserById(req, res, next) {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
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

export async function importUsersFromExcel(req, res, next) {
  const cleanup = () => {
    if (req.file) fs.unlink(req.file.path, () => {});
  };

  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const wb = xlsx.readFile(req.file.path, { cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    let rows = xlsx.utils.sheet_to_json(ws, { defval: "", raw: true });

    // check required headers
    const required = ["phone", "name", "bloodGroup"];
    const fileHeaders = rows.length ? Object.keys(rows[0]) : [];
    for (const r of required) {
      if (!fileHeaders.includes(r)) {
        cleanup();
        return res.status(400).json({
          message: `Missing required column "${r}". Accepted headers: ${ACCEPTED_HEADERS.join(
            ", "
          )}`,
        });
      }
    }

    const toSet = new Set();
    const allPhones = rows
      .map((r) => String(r.phone || "").trim())
      .filter(Boolean);
    const existing = await UserModel.find(
      { phone: { $in: [...new Set(allPhones)] } },
      { phone: 1 }
    ).lean();
    const existingSet = new Set(existing.map((u) => u.phone));

    const asBool = (v) => {
      if (typeof v === "boolean") return v;
      const s = String(v).trim().toLowerCase();
      return s === "true" || s === "1" || s === "yes";
    };

    const isDate1904 = !!(
      wb.Workbook &&
      wb.Workbook.WBProps &&
      wb.Workbook.WBProps.date1904
    );
    const parseDate = (v) => {
      if (v == null || v === "") return undefined;

      // A) Excel serial number (best case)
      if (typeof v === "number") {
        const o = xlsx.SSF.parse_date_code(v, { date1904: isDate1904 });
        if (!o) return undefined;
        // 3) Store as UTC-midnight so the calendar day is stable everywhere
        return new Date(Date.UTC(o.y, o.m - 1, o.d));
        // If you prefer a pure date string, return:
        // return `${o.y}-${String(o.m).padStart(2,'0')}-${String(o.d).padStart(2,'0')}`;
      }

      // B) If something still came through as a JS Date (e.g., copied from Google Sheets)
      if (v instanceof Date && !isNaN(v)) {
        // Round to the nearest day in local time to kill 23:59:50 / 00:00:10 glitches
        const d2 = new Date(v.getTime() + 12 * 60 * 60 * 1000);
        return new Date(
          Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate())
        );
      }

      // C) If it's a string like "8/19/1990" or "1990-08-19" (fallback)
      const s = String(v).trim();

      // ISO YYYY-MM-DD
      const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (mIso) return new Date(Date.UTC(+mIso[1], +mIso[2] - 1, +mIso[3]));

      // mm/dd/yyyy or dd/mm/yyyy -> resolve by heuristics
      const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (m) {
        let [_, a, b, c] = m;
        const yy = +c;
        const year = c.length === 2 ? (yy < 50 ? 2000 + yy : 1900 + yy) : +c;
        let month, day;
        if (+a > 12) {
          day = +a;
          month = +b;
        } // dd/mm/yyyy
        else if (+b > 12) {
          month = +a;
          day = +b;
        } // mm/dd/yyyy
        else {
          month = +a;
          day = +b;
        } // default: mm/dd/yyyy
        return new Date(Date.UTC(year, month - 1, day));
      }

      return undefined;
    };

    const ops = [];
    const errors = [];
    let inserted = 0;
    let skippedExistingDB = 0;
    let skippedDuplicateInFile = 0;

    rows.forEach((r, i) => {
      const rowNum = i + 2;
      const phone = String(r.phone || "").trim();
      const name = String(r.name || "").trim();
      const bloodGroup = String(r.bloodGroup || "")
        .trim()
        .toUpperCase();
      const address = String(r.address || "").trim() || undefined;
      const place = String(r.place || "").trim() || undefined;
      const dateOfBirth = parseDate(r.dateOfBirth);
      const gender = String(r.gender || "")
        .trim()
        .toLowerCase();
      const isDonor = asBool(r.isDonor || false);
      const lastDonationDate = parseDate(r.lastDonationDate);

      const rowErr = [];
      if (!name) rowErr.push("name is required");
      if (!phone) rowErr.push("phone is required");
      if (!bloodGroup || !VALID_BLOOD_GROUPS.includes(bloodGroup))
        rowErr.push("invalid blood group");
      if (gender && !VALID_GENDERS.includes(gender))
        rowErr.push("invalid gender");

      if (rowErr.length) {
        errors.push({ row: rowNum, phone, errors: rowErr });
        return;
      }

      if (existingSet.has(phone)) {
        skippedExistingDB++;
        return;
      }
      if (toSet.has(phone)) {
        skippedDuplicateInFile++;
        return;
      }
      toSet.add(phone);

      const doc = {
        phone,
        name,
        address,
        place,
        dateOfBirth,
        gender: gender || undefined,
        bloodGroup,
        isDonor,
        lastDonationDate,
      };

      ops.push({ insertOne: { document: doc } });
    });

    if (ops.length) {
      const result = await UserModel.bulkWrite(ops, { ordered: false });
      inserted = result.insertedCount || 0;
    }

    cleanup();
    return res.status(200).json({
      message: "Import completed",
      summary: {
        totalRows: rows.length,
        inserted,
        skippedExistingDB,
        skippedDuplicateInFile,
        invalidRows: errors.length,
      },
      errors,
      acceptedHeaders: ACCEPTED_HEADERS,
    });
  } catch (err) {
    try {
      if (req.file) fs.unlinkSync(req.file.path);
    } catch {}
    next(err);
  }
}
