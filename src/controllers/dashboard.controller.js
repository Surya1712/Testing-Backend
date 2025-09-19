import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const getChannelStats = asyncHandler(async (req, res) => {
  // Get the user ID from the request object
  const userId = req.user._id;

  // Get total subscribers
  const totalSubscribers = await Subscription.countDocuments({
    channel: userId,
  });

  // Get total videos
  const totalVideos = await Video.countDocuments({ owner: userId });

  // Get total views and likes on videos
  const videoStats = await Video.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $group: {
        _id: null,
        totalViews: { $sum: "$view" },
        totalLikes: { $sum: { $size: "$likes" } },
      },
    },
  ]);

  const stats = {
    totalSubscribers,
    totalVideos,
    totalViews: videoStats[0]?.totalViews || 0,
    totalLikes: videoStats[0]?.totalLikes || 0,
  };

  return res
    .status(200)
    .json(new ApiResponse(200, stats, "Channel stats fetched successfully"));
});

const getChannelVideos = asyncHandler(async (req, res) => {
  // Get the user ID from the request object
  const userId = req.user._id;

  // Get all videos uploaded by the channel
  const videos = await Video.find({ owner: userId });

  if (!videos || videos.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, [], "No videos found for this channel"));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, videos, "Channel videos fetched successfully"));
});

export { getChannelStats, getChannelVideos };
