import mongoose from "mongoose";

const { Schema, model } = mongoose;

const userSchema = new Schema(
  {
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
    },

    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    address: {
      type: String,
      trim: true,
    },
    place: {
      type: String,
      trim: true,
    },
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      index: true,
    },
    isDonor: {
      type: Boolean,
      default: false,
    },
    lastDonationDate: {
      type: Date,
    },
    profilePic: {
      type: String,
    },
    lastLogin: {
      type: Date,
    },

    isProfileComplete: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

const UserModel = model("User", userSchema);

export default UserModel;
