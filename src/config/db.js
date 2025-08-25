import mongoose from "mongoose";

export default async function connectDB() {
  const mongoUrl = process.env.MONGODB_URL;
  try {
    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Database connection established successfully");
  } catch (err) {
    console.error("Database connection error:", err);
    process.exit(1);
  }
}
