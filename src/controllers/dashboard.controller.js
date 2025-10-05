import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const getChannelStats = asyncHandler(async (req, res) => {
  // Get the user ID from the request object
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, "Unauthorized access: User not log`ged in");
  }

  const channelStats = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(userId),
      },
    },
    // Subscriptions (total Subscribers)
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscriptions",
      },
    },
    // videos
    {
      $lookup: {
        from: "videos",
        localField: "_id",
        foreignField: "owner",
        as: "videos",
      },
    },
    // Unwind video for individual processing
    {
      $unwind: {
        path: "$videos",
        preserveNullAndEmptyArrays: true, // To include users with no videos
      },
    },
    // likes for each video
    {
      $lookup: {
        from: "likes",
        localField: "videos._id",
        foreignField: "video",
        as: "videoLikes",
      },
    },
    // group everything to calculate final state
    {
      $group: {
        _id: "$_id",
        // totalSubscribers will be derived separately to avoid double counting
        totalViews: { $sum: "$videos.views" },
        totalVideos: {
          $sum: { $cond: [{ $ifNull: ["$videos._id", false] }, 1, 0] },
        }, //count only non-null videos
        totalLikes: { $sum: { $size: "$videoLikes" } },
      },
    },
    // final cleanup & Projection
    {
      $project: {
        _id: 0,
        totalViews: 1,
        totalVideos: 1,
        totalLikes: 1,
      },
    },
  ]);

  const finalStats = {};

  const subscribersCount = await Subscription.countDocuments({
    channel: userId,
  });
  finalStats.totalSubscribers = subscribersCount;

  // Get total views and likes on videos by the channel
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
        totalLikes: { $sum: { $size: "$likes" } },
        totalViews: { $sum: "$views" },
        totalVideos: { $sum: 1 },
      },
    },
  ]);

  finalStats.totalLikes = videoStats[0]?.totalLikes || 0;
  finalStats.totalViews = videoStats[0]?.totalViews || 0;
  finalStats.totalVideos = videoStats[0]?.totalVideos || 0;

  return res
    .status(200)
    .json(
      new ApiResponse(200, finalStats, "Channel stats fetched successfully")
    );
});

const getChannelVideos = asyncHandler(async (req, res) => {
  // Get the user ID from the request object
  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortType = "desc",
  } = req.query;
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, "Unauthorized access:User not logged in");
  }
  const videosAggregate = Video.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
        isPublished: true,
      },
    },
    // like count
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    }, // Add likes count and project necessary fields
    {
      $addFields: {
        likesCount: { $size: "$likes" },
      },
    },
    // Sort the videos
    {
      $sort: {
        [sortBy]: sortType === "desc" ? -1 : 1,
      },
    },
    // Final projection to shape the output data
    {
      $project: {
        _id: 1,
        videoFile: "$videoFile.url", // Flattening the field
        thumbnail: "$thumbnail.url", // Flattening the field
        title: 1,
        description: 1,
        views: 1,
        duration: 1,
        createdAt: 1,
        isPublished: 1,
        likesCount: 1,
      },
    },
  ]);

  // Apply pagination using the mongoose-aggregate-paginate-v2 method (assuming it's installed)
  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    customLabels: {
      docs: "videos",
      totalDocs: "totalVideos",
    },
  };

  const result = await Video.aggregatePaginate(videosAggregate, options);

  // Note: If you don't have mongoose-aggregate-paginate-v2 installed,
  // use the manual skip/limit stages (uncomment the lines below and remove the above):
  /*
    const skip = (parseInt(page) - 1) * parseInt(limit);
    videosAggregate.push({ $skip: skip }, { $limit: parseInt(limit) });
    const videos = await videosAggregate.exec();
    const totalVideos = await Video.countDocuments({ owner: userId, isPublished: true });
    
    return res.status(200).json(new ApiResponse(200, {
        videos,
        totalVideos,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalVideos / parseInt(limit)),
        hasNextPage: skip + parseInt(limit) < totalVideos
    }, "Channel videos fetched successfully"));
    */

  return res.status(200).json(
    new ApiResponse(
      200,
      result, // Returns paginated object
      "Channel videos fetched successfully"
    )
  );
});

export { getChannelStats, getChannelVideos };
