import bcrypt from "bcryptjs";
import AdminModel from "../models/adminModel.js";

export async function seedAdmin() {
  try {
    const exists = await AdminModel.findOne({ username: "admin" });
    if (exists) {
      console.log("Admin already exists");
      return;
    }
    const hashed = await bcrypt.hash("password", 10);
    await AdminModel.create({ username: "admin", password: hashed });
    console.log("Admin created");
  } catch (err) {
    console.error("Seeding failed:", err.message);
  }
}
