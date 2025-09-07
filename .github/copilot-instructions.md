# Copilot Instructions for This Codebase

## Project Overview

- This is a Node.js backend project using Express, MongoDB (via Mongoose), and JWT for authentication.
- Main entry: `src/index.js` and `src/app.js`.
- User-related logic is in `src/controllers/user.controller.js`, with models in `src/models/`.
- Middleware for authentication and file uploads is in `src/middlewares/`.
- Utility classes for error and response handling are in `src/utils/`.

## Architecture & Data Flow

- API endpoints are defined in `src/routes/` and handled by controllers in `src/controllers/`.
- User registration and login create and verify JWTs. Tokens are sent via cookies or `Authorization` header.
- File uploads (avatars, cover images) are processed with Multer and uploaded to Cloudinary via `src/utils/cloudinary.js`.
- Errors are handled using custom `ApiError` and responses with `ApiResponse` (note: check for typos in class names).

## Developer Workflows

- Start server: `node src/index.js` or use `nodemon` for auto-reload.
- No test scripts or build steps are present by default.
- Debugging: Use `console.log` for inspecting request data, tokens, and errors. JWT errors are logged in `auth.middleware.js`.

## Project-Specific Patterns

- All async route handlers use the `asyncHandler` utility for error propagation.
- JWT authentication expects tokens in either cookies (`accessToken`) or `Authorization: Bearer <token>` header.
- User model methods for token generation must be called as functions (e.g., `user.generateAccessToken()`).
- API responses use the custom `ApiResponse` class (check spelling: sometimes `ApiResponese`).
- Sensitive fields (`password`, `refreshToken`) are excluded from user responses using `.select()`.

## Integration Points

- MongoDB connection logic is in `src/db/index.js`.
- Cloudinary integration for file uploads is in `src/utils/cloudinary.js`.
- Multer middleware for file handling is in `src/middlewares/multer.middleware.js`.

## Conventions & Gotchas

- Always check for typos in utility class names (e.g., `ApiResponese` vs `ApiResponse`).
- When updating user data, use Mongoose's `validateBeforeSave: false` for refresh tokens.
- Cover image and avatar upload logic expects files in `req.files` with specific keys.
- Error handling is centralized; throw `ApiError` for any request validation or authentication issues.

## Key Files

- `src/controllers/user.controller.js`: User registration, login, logout
- `src/middlewares/auth.middleware.js`: JWT verification
- `src/models/user.model.js`: User schema and token methods
- `src/utils/ApiError.js`, `src/utils/ApiResponse.js`: Error and response utilities

---

For unclear patterns or missing documentation, ask the user for clarification or examples from their workflow.
