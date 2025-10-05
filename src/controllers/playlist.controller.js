import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js"; // Standardized import
import { ApiResponse } from "../utils/ApiResponse.js"; // Standardized import
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * @desc Creates a new user playlist.
 * @route POST /api/v1/playlists
 */
const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name?.trim() || !description?.trim()) {
    // Added trim for better validation
    throw new ApiError(400, "Name and description are both required");
  }

  const playlist = await Playlist.create({
    name,
    description,
    owner: req.user?._id,
    videos: [], // Initialize with an empty array
  });

  if (!playlist) {
    throw new ApiError(500, "Failed to create playlist");
  }

  return res
    .status(201) // Changed status to 201 Created
    .json(new ApiResponse(201, playlist, "Playlist created successfully"));
});

/**
 * @desc Updates the name and/or description of a playlist.
 * @route PATCH /api/v1/playlists/:playlistId
 */
const updatePlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const { playlistId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid Playlist ID");
  }

  if (!name?.trim() && !description?.trim()) {
    // Allow updating just one field
    throw new ApiError(400, "Name or description is required for update");
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  // Authorization check: ONLY owner can edit
  if (playlist.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(403, "You do not have permission to edit this playlist"); // 403 Forbidden
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $set: {
        // Use the new value or keep the old value if not provided
        name: name || playlist.name,
        description: description || playlist.description,
      },
    },
    { new: true }
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedPlaylist, "Playlist updated successfully")
    );
});

/**
 * @desc Deletes a playlist.
 * @route DELETE /api/v1/playlists/:playlistId
 */
const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid Playlist ID");
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  // Authorization check: ONLY owner can delete
  if (playlist.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(
      403,
      "You do not have permission to delete this playlist"
    ); // 403 Forbidden
  }

  // Delete the playlist document
  const deletionResult = await Playlist.findByIdAndDelete(playlistId);

  if (!deletionResult) {
    throw new ApiError(500, "Failed to delete playlist");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { playlistId }, // Return the ID of the deleted playlist
      "Playlist deleted successfully" // FIX: Corrected response message
    )
  );
});

/**
 * @desc Adds a video to a specific playlist.
 * @route PATCH /api/v1/playlists/add/:videoId/:playlistId
 */
const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Playlist ID or Video ID");
  }

  const playlist = await Playlist.findById(playlistId);
  const video = await Video.findById(videoId);

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  // FIX: Authorization check must only verify playlist ownership
  if (playlist.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(403, "Only the playlist owner can add videos"); // 403 Forbidden
  }

  // $addToSet ensures the video is added only if it doesn't already exist
  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $addToSet: {
        videos: videoId,
      },
    },
    { new: true }
  );

  if (!updatedPlaylist) {
    throw new ApiError(500, "Failed to add video to playlist");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedPlaylist,
        "Video added to playlist successfully"
      )
    );
});

/**
 * @desc Removes a video from a specific playlist.
 * @route PATCH /api/v1/playlists/remove/:videoId/:playlistId
 */
const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Playlist ID or Video ID");
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }
  // We don't necessarily need to check if the video exists,
  // but checking playlist ownership is crucial.

  // FIX: Authorization check must only verify playlist ownership
  if (playlist.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(403, "Only the playlist owner can remove videos"); // 403 Forbidden
  }

  // $pull removes the videoId from the videos array
  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $pull: {
        videos: videoId,
      },
    },
    { new: true }
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedPlaylist,
        "Video removed from playlist successfully"
      )
    );
});

/**
 * @desc Gets a playlist by its ID, along with video and owner details.
 * @route GET /api/v1/playlists/:playlistId
 */
const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid Playlist ID");
  }

  // Note: No need for a separate findById check if the aggregation handles 404
  // If aggregation returns an empty array, the playlist doesn't exist or doesn't have public videos.

  const playlistVideos = await Playlist.aggregate([
    {
      // Stage 1: Match the specific playlist
      $match: {
        _id: new mongoose.Types.ObjectId(playlistId),
      },
    },
    {
      // Stage 2: Join with videos
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
      },
    },
    {
      // Stage 3: Filter out unpublished videos (Safety)
      $match: {
        $or: [
          { "videos.isPublished": true },
          { owner: req.user?._id }, // Allow owner to see unpublished videos in their own list
        ],
      },
    },
    {
      // Stage 4: Join with owner details
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
              avatar: "$avatar.url",
            },
          },
        ],
      },
    },
    {
      // Stage 5: Calculate total stats and deconstruct owner
      $addFields: {
        totalVideos: { $size: "$videos" },
        totalViews: { $sum: "$videos.views" },
        owner: { $first: "$owner" },
      },
    },
    {
      // Stage 6: Final Projection
      $project: {
        name: 1,
        description: 1,
        createdAt: 1,
        updatedAt: 1,
        totalVideos: 1,
        totalViews: 1,
        videos: {
          _id: 1,
          videoFile: "$videos.videoFile.url",
          thumbnail: "$videos.thumbnail.url",
          title: 1,
          description: 1,
          duration: 1,
          createdAt: 1,
          views: 1,
        },
        owner: 1,
      },
    },
  ]);

  if (!playlistVideos?.length) {
    throw new ApiError(404, "Playlist not found or is empty/private");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, playlistVideos[0], "Playlist fetched successfully")
    );
});

/**
 * @desc Gets all playlists created by a specific user.
 * @route GET /api/v1/playlists/user/:userId
 */
const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid User ID");
  }

  const playlists = await Playlist.aggregate([
    {
      // Stage 1: Match playlists owned by the user
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      // Stage 2: Join with videos
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
      },
    },
    {
      // Stage 3: Calculate stats and project fields
      $addFields: {
        totalVideos: { $size: "$videos" },
        totalViews: { $sum: "$videos.views" },
      },
    },
    {
      // Stage 4: Final Projection
      $project: {
        _id: 1,
        name: 1,
        description: 1,
        totalVideos: 1,
        totalViews: 1,
        updatedAt: 1,
        // Optionally expose the thumbnail of the first video in the list
        firstVideoThumbnail: { $first: "$videos.thumbnail.url" },
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(200, playlists, "User playlists fetched successfully")
    );
});

export {
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  getPlaylistById,
  getUserPlaylists,
};
