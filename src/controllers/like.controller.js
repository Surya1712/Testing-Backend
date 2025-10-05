import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * @desc Toggles like status for a video
 * @route POST /api/v1/likes/toggle/v/:videoId
 */
const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user?._id; // Current authenticated user

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  // Safety check: ensure user is authenticated
  if (!userId) {
    throw new ApiError(401, "User not authenticated");
  }

  const likePayload = {
    video: videoId,
    likedBy: userId,
  };

  // Use updateOne with upsert for atomic operation (optional, but robust)
  const likedAlready = await Like.findOne(likePayload);

  let isLiked = false;
  let message = "";

  if (likedAlready) {
    // Unlike: Delete the existing like document
    await Like.findByIdAndDelete(likedAlready._id);
    isLiked = false;
    message = "Video unlinked successfully";
  } else {
    // Like: Create a new like document
    await Like.create(likePayload);
    isLiked = true;
    message = "Video liked successfully";
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { videoId, isLiked }, message));
});

// ------------------------------------------------------------------

/**
 * @desc Toggles like status for a comment
 * @route POST /api/v1/likes/toggle/c/:commentId
 */
const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user?._id;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment ID");
  }

  if (!userId) {
    throw new ApiError(401, "User not authenticated");
  }

  const likePayload = {
    comment: commentId,
    likedBy: userId,
  };

  const likedAlready = await Like.findOne(likePayload);

  let isLiked = false;
  let message = "";

  if (likedAlready) {
    // Unlike
    await Like.findByIdAndDelete(likedAlready._id);
    isLiked = false;
    message = "Comment unlinked successfully";
  } else {
    // Like
    await Like.create(likePayload);
    isLiked = true;
    message = "Comment liked successfully";
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { commentId, isLiked }, message));
});

// ------------------------------------------------------------------

/**
 * @desc Toggles like status for a tweet
 * @route POST /api/v1/likes/toggle/t/:tweetId
 */
const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const userId = req.user?._id;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet ID");
  }

  if (!userId) {
    throw new ApiError(401, "User not authenticated");
  }

  const likePayload = {
    tweet: tweetId,
    likedBy: userId,
  };

  const likedAlready = await Like.findOne(likePayload);

  let isLiked = false;
  let message = "";

  if (likedAlready) {
    // Unlike
    await Like.findByIdAndDelete(likedAlready._id);
    isLiked = false;
    message = "Tweet unlinked successfully";
  } else {
    // Like
    await Like.create(likePayload);
    isLiked = true;
    message = "Tweet liked successfully";
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { tweetId, isLiked }, message));
});

// ------------------------------------------------------------------

/**
 * @desc Gets all videos liked by the current authenticated user.
 * @route GET /api/v1/likes/videos
 */
const getLikedVideos = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    // Should be caught by middleware, but a final check is safe
    throw new ApiError(401, "User not authenticated");
  }

  const likedVideosAggregate = await Like.aggregate([
    {
      // Stage 1: Match likes associated with the current user AND where 'video' field is present
      $match: {
        likedBy: new mongoose.Types.ObjectId(userId),
        video: { $exists: true }, // Ensure we only get video likes
      },
    },
    {
      // Stage 2: Join with the 'videos' collection
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "likedVideo",
        pipeline: [
          {
            // Sub-Stage 1: Join with 'users' to get video owner details
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "ownerDetails",
              pipeline: [
                {
                  $project: {
                    username: 1,
                    fullName: 1,
                    avatar: "$avatar.url",
                  },
                },
              ],
            },
          },
          {
            // Sub-Stage 2: Deconstruct the single element ownerDetails array
            $unwind: "$ownerDetails",
          },
          {
            // Sub-Stage 3: Project the video fields
            $project: {
              videoFile: "$videoFile.url",
              thumbnail: "$thumbnail.url",
              owner: 1,
              title: 1,
              description: 1,
              views: 1,
              duration: 1,
              createdAt: 1,
              isPublished: 1,
              ownerDetails: 1,
            },
          },
        ],
      },
    },
    {
      // Stage 3: Deconstruct the single element likedVideo array
      $unwind: "$likedVideo",
    },
    {
      // Stage 4: Sort by the creation time of the *Like* document (most recently liked first)
      $sort: {
        createdAt: -1,
      },
    },
    {
      // Stage 5: Final projection to structure the response
      $project: {
        _id: 0,
        likedVideo: 1,
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        likedVideosAggregate,
        "Liked videos fetched successfully"
      )
    );
});

export { toggleVideoLike, toggleCommentLike, toggleTweetLike, getLikedVideos };
