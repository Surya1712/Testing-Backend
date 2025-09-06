import { User } from "../models/user.model";
import { ApiError } from "../utiles/ApiError";
import { ApiRespones } from "../utiles/ApiResponse";
import { asyncHandler } from "../utiles/asyncHandler";
import jwt from "jsonwebtoken";

// you cannot use req,res then you can use _
export const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer", "");

    if (!token) {
      throw new ApiError(401, "Unauthorized request");
    }

    const decodedToken = jwt.verify(token, process.env.ACEESS_TOKEN_SECRET);

    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );

    if (!user) {
      //TODO : discuss about frontend
      throw new ApiError(401, "Invalid Access Token");
    }

    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid access token");
  }
});
