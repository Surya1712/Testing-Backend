import mongoose from "mongoose";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler";

const healthCheck = asyncHandler(async (req, res) => {
  //TODO: build a healthcheck response that simple return the ok status as json with a message
});

export { healthCheck };
