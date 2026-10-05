import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export async function hashPassword(plain) {
  return bcrypt.hash(plain, env.bcryptRounds);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwt.secret); // throws on invalid/expired
}