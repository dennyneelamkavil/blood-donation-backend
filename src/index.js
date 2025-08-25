import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import router from "./routes/router.js";
import errorHandler from "./middleware/errorHandler.js";

dotenv.config();
const PORT = process.env.PORT || 8165;

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: (origin, callback) => callback(null, true),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  })
);

app.use(cookieParser());
connectDB();

app.use("/public", express.static("public"));

app.use("/api", router);

app.use((req, res) => res.status(404).json({ message: "Route not found" }));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
