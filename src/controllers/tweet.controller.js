import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"; // Standardized to uppercase
import { Tweet } from "../models/tweet.model.js";
import { ApiResponse } from "../utils/ApiResponse.js"; // Standardized to uppercase
import mongoose, { isValidObjectId } from "mongoose";
// import { User } from "../models/user.model.js"; // Not needed in controller

/**
 * @desc Creates a new tweet.
 * @route POST /api/v1/tweets
 */
const createTweet = asyncHandler(async (req, res) => {
  const { content } = req.body;

  if (!content?.trim()) {
    // Added .trim() for better validation
    throw new ApiError(400, "Tweet content is required");
  }

  const tweet = await Tweet.create({
    content,
    owner: req.user?._id,
  });

  if (!tweet) {
    throw new ApiError(500, "Failed to create tweet. Please try again.");
  }

  return res
    .status(201) // Use 201 Created for resource creation
    .json(new ApiResponse(201, tweet, "Tweet created successfully"));
});

// ---

/**
 * @desc Updates the content of a tweet.
 * @route PATCH /api/v1/tweets/:tweetId
 */
const updateTweet = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const { tweetId } = req.params;

  if (!content?.trim()) {
    throw new ApiError(400, "Tweet content is required for update");
  }

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid Tweet ID");
  }

  const tweet = await Tweet.findById(tweetId);

  if (!tweet) {
    throw new ApiError(404, "Tweet not found");
  }

  // FIX: Changed 400 Bad Request to 403 Forbidden for authorization failure.
  if (tweet?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(403, "You do not have permission to edit this tweet");
  }

  const newTweet = await Tweet.findByIdAndUpdate(
    tweetId,
    {
      $set: {
        content,
      },
    },
    { new: true }
  );

  if (!newTweet) {
    // This should theoretically not happen if checks pass, but remains a 500 safety net.
    throw new ApiError(500, "Failed to update tweet. Please try again.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, newTweet, "Tweet updated successfully"));
});

// ---

/**
 * @desc Deletes a tweet by its ID.
 * @route DELETE /api/v1/tweets/:tweetId
 */
const deleteTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid Tweet ID");
  }

  const tweet = await Tweet.findById(tweetId);

  if (!tweet) {
    throw new ApiError(404, "Tweet not found");
  }

  // FIX: Changed 400 Bad Request to 403 Forbidden for authorization failure.
  if (tweet?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(403, "You do not have permission to delete this tweet");
  }

  // Delete the tweet
  await Tweet.findByIdAndDelete(tweetId);

  // Note: You may also want to delete all associated Likes and Comments here
  // For simplicity, we keep the original logic, which just deletes the tweet.

  return res
    .status(200)
    .json(new ApiResponse(200, { tweetId }, "Tweet deleted successfully"));
});

// ---

/**
 * @desc Gets all tweets for a specific user, including like count and current user's like status.
 * @route GET /api/v1/tweets/user/:userId
 */
const getUserTweets = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user?._id;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid User ID");
  }

  const tweets = await Tweet.aggregate([
    {
      // Stage 1: Match tweets owned by the requested user
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      // Stage 2: Get owner details (User lookup)
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
        pipeline: [
          {
            $project: {
              username: 1,
              avatar: "$avatar.url", // Direct projection for cleaner output
            },
          },
        ],
      },
    },
    {
      // Stage 3: Get like details (Likes lookup)
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "tweet",
        as: "likeDetails",
        pipeline: [
          {
            $project: {
              likedBy: 1,
            },
          },
        ],
      },
    },
    {
      // Stage 4: Add calculated fields
      $addFields: {
        likesCount: {
          $size: "$likeDetails",
        },
        ownerDetails: {
          $first: "$ownerDetails", // Deconstruct array to object
        },
        isLiked: {
          $cond: {
            // Check if the current authenticated user's ID is in the array of people who liked this tweet
            if: { $in: [currentUserId, "$likeDetails.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      // Stage 5: Sort by creation date (newest first)
      $sort: {
        createdAt: -1,
      },
    },
    {
      // Stage 6: Final Projection (clean up)
      $project: {
        content: 1,
        ownerDetails: 1,
        likesCount: 1,
        createdAt: 1,
        updatedAt: 1, // Include updatedAt for better context
        isLiked: 1,
      },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, tweets, "Tweets fetched successfully"));
});

export { createTweet, updateTweet, deleteTweet, getUserTweets };
