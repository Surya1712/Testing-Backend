import mongoose, { isValidObjectId } from "mongoose"; // Added isValidObjectId for robust checks
import { Comment } from "../models/comment.model.js";
import { Video } from "../models/video.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js"; // Standardized import
import { ApiResponse } from "../utils/ApiResponse.js"; // Standardized import
import { asyncHandler } from "../utils/asyncHandler.js"; // Standardized import

// Make sure Comment model is configured with mongoose-aggregate-paginate-v2

/**
 * @desc Get all comments for a specific video with pagination.
 * @route GET /api/v1/comments/:videoId
 */
const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  // Default page 1, limit 10, ensure they are integers for safety
  const { page = 1, limit = 10 } = req.query;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Video ID");
  }

  // 1. Check if video exists (optional but good practice)
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const commentsAggregate = Comment.aggregate([
    {
      // Stage 1: Filter comments for the specific video
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      // Stage 2: Join with users to get the comment owner's details
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              username: 1,
              fullName: 1,
              avatar: "$avatar.url", // Project avatar URL directly
            },
          },
        ],
      },
    },
    {
      // Stage 3: Join with likes to get like count and user's like status
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "comment",
        as: "likes",
      },
    },
    {
      // Stage 4: Deconstruct owner array and add computed fields
      $addFields: {
        owner: { $first: "$owner" }, // Deconstruct owner
        likesCount: { $size: "$likes" }, // Calculate total likes
        isLiked: {
          // Check if the current logged-in user liked the comment
          $cond: {
            if: { $in: [req.user?._id, "$likes.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      // Stage 5: Sort by newest comment first
      $sort: { createdAt: -1 },
    },
    {
      // Stage 6: Final projection to shape the output
      $project: {
        content: 1,
        createdAt: 1,
        updatedAt: 1, // Added update time for better UX
        likesCount: 1,
        isLiked: 1,
        owner: 1,
      },
    },
  ]);

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { createdAt: -1 }, // Added sort to options for paginate, though it's already in aggregate
  };

  // Note: This relies on the Mongoose model being configured with 'mongoose-aggregate-paginate-v2'
  const comments = await Comment.aggregatePaginate(commentsAggregate, options);

  return res
    .status(200)
    .json(new ApiResponse(200, comments, "Comments fetched successfully"));
});

/**
 * @desc Add a comment to a specific video.
 * @route POST /api/v1/comments/:videoId
 */
const addComment = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { content } = req.body;

  if (!content?.trim()) {
    // Use optional chaining and trim for robust check
    throw new ApiError(400, "Comment content is required");
  }

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Video ID");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const comment = await Comment.create({
    content,
    video: videoId,
    owner: req.user?._id,
  });

  if (!comment) {
    throw new ApiError(500, "Failed to add comment, please try again");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, comment, "Comment added successfully"));
});

/**
 * @desc Update a user's own comment.
 * @route PATCH /api/v1/comments/c/:commentId
 */
const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  if (!content?.trim()) {
    throw new ApiError(400, "Comment content is required for update");
  }

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid Comment ID");
  }

  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  // Authorization check: ensure the current user owns the comment
  if (comment?.owner.toString() !== req.user?._id.toString()) {
    // Changed 400 to 403 Forbidden for clearer authorization error
    throw new ApiError(403, "You can only edit your own comment");
  }

  const updatedComment = await Comment.findByIdAndUpdate(
    commentId, // Use commentId directly
    {
      $set: {
        content,
      },
    },
    { new: true }
  );

  if (!updatedComment) {
    throw new ApiError(500, "Failed to update comment, please try again");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedComment, "Comment updated successfully"));
});

/**
 * @desc Delete a user's own comment and associated likes.
 * @route DELETE /api/v1/comments/c/:commentId
 */
const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid Comment ID");
  }

  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  // Authorization check
  if (comment?.owner.toString() !== req.user?._id.toString()) {
    // Changed 400 to 403 Forbidden
    throw new ApiError(403, "You can only delete your own comment");
  }

  // 1. Delete the comment itself
  await Comment.findByIdAndDelete(commentId);

  // 2. Delete ALL likes associated with this comment (Improved: deleteMany without likedBy filter)
  await Like.deleteMany({
    comment: commentId,
  });
  // Rationale: A comment delete should cascade and remove ALL likes on it,
  // regardless of who created the like.

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { deletedCommentId: commentId },
        "Comment deleted successfully"
      )
    );
});

export { getVideoComments, addComment, updateComment, deleteComment };
