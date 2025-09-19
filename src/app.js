import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: "60mb" }));
app.use(express.urlencoded({ extended: true, limit: "60mb" }));
app.use(express.static("public"));
app.use(cookieParser());

//! routes import

import userRouter from "./routes/user.routes.js";
import videoRouter from "./routes/video.routes.js";

//! routes declaration
app.use("/api/v1/users", userRouter);
app.use("api/v1/video", videoRouter);

/*
 *how to generate url 
! without api
* http://localhost:8000/users/register 
! with api 
* http://localhost:8000/api/v1/users/register 
 */

export default app;
