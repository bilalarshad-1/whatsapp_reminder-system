import { badRequest } from './http.js';

export function requireString(value, field, { min = 1, max = 5000 } = {}) {
  if (typeof value !== 'string') throw badRequest(`${field} must be a string`);
  const v = value.trim();
  if (v.length < min) throw badRequest(`${field} must be at least ${min} chars`);
  if (v.length > max) throw badRequest(`${field} must be at most ${max} chars`);
  return v;
}

export function requireDate(value, field) {
  if (value === undefined || value === null || value === '') {
    throw badRequest(`${field} is required`);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw badRequest(`${field} is not a valid date`);
  return d;
}

export function optionalInt(value, field, { min = 0, max = 100000 } = {}) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isInteger(n)) throw badRequest(`${field} must be an integer`);
  if (n < min || n > max) throw badRequest(`${field} must be between ${min} and ${max}`);
  return n;
}

export function optionalEnum(value, field, allowed, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (!allowed.includes(value)) {
    throw badRequest(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return value;
}