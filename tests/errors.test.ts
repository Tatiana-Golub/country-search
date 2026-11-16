import { describe, expect, it } from 'vitest';
import { classifyError, HttpError } from '../src/errors.js';

describe('HttpError', () => {
  it('extends Error', () => {
    const error = new HttpError(503);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HttpError);
  });

  it('stores the response status', () => {
    expect(new HttpError(503).status).toBe(503);
  });

  it('has a readable name and message', () => {
    const error = new HttpError(500);
    expect(error.name).toBe('HttpError');
    expect(error.message).toContain('500');
  });
});

describe('classifyError', () => {
  it('own cancellation (AbortError) is "aborted"', () => {
    expect(classifyError(new DOMException('cancelled', 'AbortError'))).toBe('aborted');
  });

  it('TimeoutError is "timeout", not "aborted"', () => {
    expect(classifyError(new DOMException('too slow', 'TimeoutError'))).toBe('timeout');
  });

  it('HttpError is "http"', () => {
    expect(classifyError(new HttpError(500))).toBe('http');
  });

  it('a fetch network failure (TypeError) is "network"', () => {
    expect(classifyError(new TypeError('Failed to fetch'))).toBe('network');
  });

  it('unknown thrown values are "network", so they are shown and never swallowed', () => {
    expect(classifyError('boom')).toBe('network');
    expect(classifyError(undefined)).toBe('network');
    expect(classifyError(null)).toBe('network');
  });
});
