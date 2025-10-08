import mongoose, { isValidObjectId } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"; // Standard import naming convention
import { ApiResponse } from "../utils/ApiResponse.js"; // Standard import naming convention
import { Subscription } from "../models/subscription.model.js";

/**
 * @desc Toggles the subscription status for a given channel.
 * @route POST /api/v1/subscriptions/c/:channelId
 */
const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel ID");
  }

  const isSubscribed = await Subscription.findOne({
    // The user making the request (from the JWT payload via middleware)
    subscriber: req.user?._id,
    channel: channelId,
  });

  let subscribedStatus = false;
  let message = "Subscription toggled successfully";

  if (isSubscribed) {
    // Unsubscribe: Delete the subscription document
    await Subscription.findByIdAndDelete(isSubscribed?._id);
    subscribedStatus = false;
    message = "Unsubscribed successfully";
  } else {
    // Subscribe: Create a new subscription document
    await Subscription.create({
      subscriber: req.user?._id,
      channel: channelId,
    });
    subscribedStatus = true;
    message = "Subscribed successfully";
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { subscribed: subscribedStatus, channelId: channelId },
        message
      )
    );
});

// ------------------------------------------------------------------

/**
 * @desc Gets the list of subscribers for a given channel.
 * @route GET /api/v1/subscriptions/u/:channelId
 */
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel ID");
  }

  const channelObjectId = new mongoose.Types.ObjectId(channelId);

  const subscribers = await Subscription.aggregate([
    {
      // Stage 1: Filter subscriptions where the 'channel' field matches the provided channelId
      $match: {
        channel: new mongoose.Types.ObjectId(channelId),
      },
    },
    {
      // Stage 2: Join with the 'users' collection using the 'subscriber' ID
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscriber",
        pipeline: [
          {
            // Sub-Stage 1: Calculate if the requesting user is subscribed to this current subscriber (nested subscription check)
            $lookup: {
              from: "subscriptions",
              localField: "_id", // The current subscriber's ID
              foreignField: "channel", // Is the subscriber being subscribed to by the requesting user?
              as: "subscribedToSubscriber",
            },
          },
          {
            // Sub-Stage 2: Add computed fields for clarity
            $addFields: {
              // Check if the current requesting user's ID exists in the list of subscribers for this subscriber
              subscribedToSubscriber: {
                $cond: {
                  if: {
                    $in: [
                      // req.user._id is the logged-in user making the request
                      req.user?._id, // NOTE: This assumes req.user._id is available
                      "$subscribedToSubscriber.subscriber", // Check if the logged-in user is in the subscriber list of the current subscriber
                    ],
                  },
                  then: true,
                  else: false,
                },
              },
              subscribersCount: {
                $size: "$subscribedToSubscriber",
              },
            },
          },
          {
            // Sub-Stage 3: Project the necessary fields from the user/subscriber object
            $project: {
              username: 1,
              fullName: 1,
              avatar: 1,
              subscribedToSubscriber: 1,
              subscribersCount: 1,
            },
          },
        ],
      },
    },
    {
      // Stage 3: Deconstruct the single 'subscriber' array element into an object
      $unwind: "$subscriber",
    },
    {
      // Stage 4: Final output projection
      $project: {
        _id: 0, // Exclude the subscription ID
        subscriber: 1,
      },
    },
  ]);

  // Handle case where no subscribers are found
  if (!subscribers) {
    throw new ApiError(404, "No subscribers found for this channel");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, subscribers, "Subscribers fetched successfully")
    );
});

// ------------------------------------------------------------------

/**
 * @desc Gets the list of channels a user is subscribed to.
 * @route GET /api/v1/subscriptions/:subscriberId
 */
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params; // The ID of the user whose subscriptions we want

  if (!isValidObjectId(subscriberId)) {
    throw new ApiError(400, "Invalid subscriber ID");
  }

  const subscribedChannels = await Subscription.aggregate([
    {
      // Stage 1: Match subscriptions where the 'subscriber' field is the provided ID
      $match: {
        subscriber: new mongoose.Types.ObjectId(subscriberId),
      },
    },
    {
      // Stage 2: Join with the 'users' collection on the 'channel' field (the subscribed channel)
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "subscribedChannel",
        pipeline: [
          {
            // Sub-Stage 1: Look up videos for this channel
            $lookup: {
              from: "videos",
              localField: "_id",
              foreignField: "owner",
              as: "videos",
            },
          },
          {
            // Sub-Stage 2: Get the latest video (assuming videos are sorted by createdAt)
            $addFields: {
              latestVideo: {
                $last: "$videos",
              },
            },
          },
          {
            // Sub-Stage 3: Project video and channel details
            $project: {
              _id: 1,
              username: 1,
              fullName: 1,
              avatar: 1,
              latestVideo: {
                _id: 1,
                videoFile: 1,
                thumbnail: 1,
                title: 1,
                description: 1,
                duration: 1,
                createdAt: 1,
                views: 1,
              },
            },
          },
        ],
      },
    },
    {
      // Stage 3: Deconstruct the single 'subscribedChannel' array element into an object
      $unwind: "$subscribedChannel",
    },
    {
      // Stage 4: Final projection to structure the output
      $project: {
        _id: 0,
        subscribedChannel: 1,
      },
    },
  ]);

  // The output is an array of objects, each containing the subscribedChannel object.
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        subscribedChannels,
        "Subscribed channels fetched successfully"
      )
    );
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
