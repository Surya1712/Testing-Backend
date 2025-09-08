import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler";

const getChannelStats = asyncHandler(async (req, res) => {
  //TODO: Get the channel stats like total video views, total subscribers, total videos, total likes ect.
});

const getChannelVideos = asyncHandler(async (req, res) => {
  //TODO: Get all the video uploaded by the channel
});

export { getChannelStats, getChannelVideos };
