import mongoose from 'mongoose';
import { User } from '../models/index.js';

/**
 * Resolves req.user from the "x-user-id" header.
 * Temporary replacement for JWT auth (Phase 8).
 */
export async function requireUser(req, res, next) {
  try {
    const raw = req.header('x-user-id');

    if (!raw) {
      return res.status(401).json({
        ok: false,
        error: 'Missing x-user-id header',
      });
    }

    if (!mongoose.isValidObjectId(raw)) {
      return res.status(400).json({
        ok: false,
        error: 'x-user-id is not a valid Mongo ObjectId',
      });
    }

    const user = await User.findById(raw);
    if (!user) {
      return res.status(404).json({
        ok: false,
        error: 'User not found for x-user-id',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}