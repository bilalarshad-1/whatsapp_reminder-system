import { User } from '../models/index.js';
import { verifyToken } from '../services/auth.service.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.header('authorization') || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({
        ok: false,
        error: 'Missing or malformed Authorization header',
      });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch (e) {
      return res.status(401).json({
        ok: false,
        error: 'Invalid or expired token',
      });
    }

    const user = await User.findById(payload.sub);
    if (!user || !user.active) {
      return res.status(401).json({
        ok: false,
        error: 'User not found or inactive',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}