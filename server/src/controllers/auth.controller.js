import { User } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireString } from '../utils/validate.js';
import { badRequest, HttpError } from '../utils/http.js';
import {
  hashPassword,
  verifyPassword,
  signToken,
} from '../services/auth.service.js';

const MIN_PASSWORD = 6;

/**
 * POST /api/auth/register
 * body: { name, email, password, whatsappId, timezone? }
 */
export const register = asyncHandler(async (req, res) => {
  const name = requireString(req.body.name, 'name', { min: 1, max: 80 });
  const email = requireString(req.body.email, 'email', { min: 3, max: 200 }).toLowerCase();
  const password = requireString(req.body.password, 'password', { min: MIN_PASSWORD, max: 200 });
  const whatsappId = requireString(req.body.whatsappId, 'whatsappId', { min: 6, max: 40 });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw badRequest('email is not valid');
  }
  if (!/^user:\d+$/.test(whatsappId)) {
    throw badRequest('whatsappId must be "user:<digits>"');
  }

  const existing = await User.findOne({ $or: [{ email }, { whatsappId }] });
  if (existing) {
    if (existing.email === email) throw new HttpError(409, 'Email already registered');
    if (existing.whatsappId === whatsappId) throw new HttpError(409, 'whatsappId already in use');
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({
    name,
    email,
    passwordHash,
    whatsappId,
    timezone: req.body.timezone || 'Asia/Karachi',
  });

  const token = signToken(user);
  res.status(201).json({ ok: true, token, user: user.toSafeJSON() });
});

/**
 * POST /api/auth/login
 * body: { email, password }
 */
export const login = asyncHandler(async (req, res) => {
  const email = requireString(req.body.email, 'email', { min: 3, max: 200 }).toLowerCase();
  const password = requireString(req.body.password, 'password', { min: 1, max: 200 });

  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !user.active) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const token = signToken(user);
  res.json({ ok: true, token, user: user.toSafeJSON() });
});

/**
 * GET /api/auth/me
 */
export const me = asyncHandler(async (req, res) => {
  res.json({ ok: true, user: req.user.toSafeJSON() });
});