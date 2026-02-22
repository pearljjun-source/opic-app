import { Alert } from 'react-native';
import {
  AppError,
  ERROR_CODES,
  ERROR_MESSAGES,
  ERROR_CATEGORIES,
  CATEGORY_CONFIG,
  DISPLAY_METHODS,
  classifyError,
  classifyAuthError,
  classifyRpcError,
  getUserMessage,
  handleError,
  isAppError,
  getDisplayMethod,
} from '@/lib/errors';
import type { ErrorCode, ErrorCategory } from '@/lib/errors';

// Mock Alert
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// Mock __DEV__
(global as any).__DEV__ = true;

// Suppress console.warn from handleError during tests
jest.spyOn(console, 'warn').mockImplementation(() => {});

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================================
// AppError class
// ============================================================================
describe('AppError class', () => {
  it('creates with correct code, category, userMessage, displayMethod, isRetryable', () => {
    const err = new AppError('NETWORK_OFFLINE');

    expect(err.code).toBe('NETWORK_OFFLINE');
    expect(err.category).toBe('network');
    expect(err.userMessage).toBe(ERROR_MESSAGES.NETWORK_OFFLINE);
    expect(err.displayMethod).toBe('banner');
    expect(err.isRetryable).toBe(true);
  });

  it('is instanceof Error', () => {
    const err = new AppError('SVR_UNKNOWN');
    expect(err).toBeInstanceOf(Error);
  });

  it('.message equals Korean userMessage', () => {
    const err = new AppError('AUTH_REQUIRED');
    expect(err.message).toBe('로그인이 필요합니다');
    expect(err.message).toBe(ERROR_MESSAGES.AUTH_REQUIRED);
  });

  it('.name equals "AppError"', () => {
    const err = new AppError('SVR_UNKNOWN');
    expect(err.name).toBe('AppError');
  });

  it('stores metadata when provided', () => {
    const original = new Error('original');
    const err = new AppError('SVR_UNKNOWN', { originalError: original, statusCode: 500 });

    expect(err.metadata.originalError).toBe(original);
    expect(err.metadata.statusCode).toBe(500);
  });

  it('defaults metadata to empty object when not provided', () => {
    const err = new AppError('SVR_UNKNOWN');
    expect(err.metadata).toEqual({});
  });

  describe('AppError.withMessage()', () => {
    it('overrides userMessage and message', () => {
      const customMsg = '5분 후 다시 시도해주세요';
      const err = AppError.withMessage('RATE_WHISPER', customMsg);

      expect(err.userMessage).toBe(customMsg);
      expect(err.message).toBe(customMsg);
      expect(err.code).toBe('RATE_WHISPER');
      expect(err.category).toBe('rate_limit');
    });

    it('preserves metadata', () => {
      const err = AppError.withMessage('RATE_TTS', 'custom', { remaining: 0 });
      expect(err.metadata.remaining).toBe(0);
    });
  });

  it('maps validation codes to inline display and non-retryable', () => {
    const err = new AppError('VAL_EMAIL_REQUIRED');
    expect(err.displayMethod).toBe('inline');
    expect(err.isRetryable).toBe(false);
    expect(err.category).toBe('validation');
  });

  it('maps server codes to toast_error display and retryable', () => {
    const err = new AppError('SVR_DATABASE');
    expect(err.displayMethod).toBe('toast_error');
    expect(err.isRetryable).toBe(true);
    expect(err.category).toBe('server');
  });

  it('maps auth codes to alert display and non-retryable', () => {
    const err = new AppError('AUTH_INVALID_CREDENTIALS');
    expect(err.displayMethod).toBe('alert');
    expect(err.isRetryable).toBe(false);
  });

  it('maps conflict codes to toast_warning display and non-retryable', () => {
    const err = new AppError('CONFLICT_EMAIL_EXISTS');
    expect(err.displayMethod).toBe('toast_warning');
    expect(err.isRetryable).toBe(false);
  });
});

// ============================================================================
// ERROR_MESSAGES completeness
// ============================================================================
describe('ERROR_MESSAGES completeness', () => {
  const allCodes = Object.values(ERROR_CODES);

  it('every ErrorCode has an entry in ERROR_MESSAGES', () => {
    for (const code of allCodes) {
      expect(ERROR_MESSAGES).toHaveProperty(code);
    }
  });

  it('no empty messages', () => {
    for (const code of allCodes) {
      const message = ERROR_MESSAGES[code as ErrorCode];
      expect(typeof message).toBe('string');
      expect(message.trim().length).toBeGreaterThan(0);
    }
  });

  it('ERROR_MESSAGES keys match ERROR_CODES values exactly', () => {
    const messageKeys = Object.keys(ERROR_MESSAGES).sort();
    const codeValues = Object.values(ERROR_CODES).sort();
    expect(messageKeys).toEqual(codeValues);
  });
});

// ============================================================================
// ERROR_CODE_CATEGORY completeness
// ============================================================================
describe('ERROR_CODE_CATEGORY completeness', () => {
  it('every ErrorCode has a valid category (verified via AppError constructor)', () => {
    const allCodes = Object.values(ERROR_CODES);
    for (const code of allCodes) {
      const err = new AppError(code as ErrorCode);
      const validCategories = Object.values(ERROR_CATEGORIES);
      expect(validCategories).toContain(err.category);
    }
  });

  it('category assignments are consistent with code prefixes', () => {
    const prefixCategoryMap: Record<string, string> = {
      NETWORK_: 'network',
      AUTH_: 'auth',
      PERM_: 'permission',
      VAL_: 'validation',
      NF_: 'not_found',
      CONFLICT_: 'conflict',
      RATE_: 'rate_limit',
      SVR_: 'server',
    };

    const allCodes = Object.values(ERROR_CODES);
    for (const code of allCodes) {
      const err = new AppError(code as ErrorCode);
      for (const [prefix, expectedCategory] of Object.entries(prefixCategoryMap)) {
        if (code.startsWith(prefix)) {
          expect(err.category).toBe(expectedCategory);
          break;
        }
      }
    }
  });
});

// ============================================================================
// classifyError()
// ============================================================================
describe('classifyError()', () => {
  describe('passthrough and null handling', () => {
    it('AppError passes through unchanged', () => {
      const original = new AppError('AUTH_REQUIRED');
      const result = classifyError(original);
      expect(result).toBe(original);
    });

    it('null returns AppError with SVR_UNKNOWN', () => {
      const result = classifyError(null);
      expect(result).toBeInstanceOf(AppError);
      expect(result.code).toBe('SVR_UNKNOWN');
    });

    it('undefined returns AppError with SVR_UNKNOWN', () => {
      const result = classifyError(undefined);
      expect(result).toBeInstanceOf(AppError);
      expect(result.code).toBe('SVR_UNKNOWN');
    });
  });

  describe('string errors (delegates to classifyRpcError)', () => {
    it('INVALID_CODE maps to VAL_INVITE_CODE_INVALID', () => {
      const result = classifyError('INVALID_CODE');
      expect(result.code).toBe('VAL_INVITE_CODE_INVALID');
    });

    it('NOT_AUTHENTICATED maps to AUTH_REQUIRED', () => {
      const result = classifyError('NOT_AUTHENTICATED');
      expect(result.code).toBe('AUTH_REQUIRED');
    });

    it('unknown RPC string maps to SVR_UNKNOWN', () => {
      const result = classifyError('SOME_RANDOM_STRING');
      expect(result.code).toBe('SVR_UNKNOWN');
    });
  });

  describe('PostgrestError-like objects', () => {
    it('PGRST116 maps to NF_* based on context.resource', () => {
      const pgError = { code: 'PGRST116', message: 'Row not found' };

      const resultScript = classifyError(pgError, { resource: 'script' });
      expect(resultScript.code).toBe('NF_SCRIPT');

      const resultPractice = classifyError(pgError, { resource: 'practice' });
      expect(resultPractice.code).toBe('NF_PRACTICE');

      const resultInvite = classifyError(pgError, { resource: 'invite' });
      expect(resultInvite.code).toBe('NF_INVITE');
    });

    it('PGRST116 without context.resource maps to SVR_DATABASE', () => {
      const pgError = { code: 'PGRST116', message: 'Row not found' };
      const result = classifyError(pgError);
      expect(result.code).toBe('SVR_DATABASE');
    });

    it('42501 maps to PERM_UNAUTHORIZED', () => {
      const pgError = { code: '42501', message: 'Permission denied' };
      const result = classifyError(pgError);
      expect(result.code).toBe('PERM_UNAUTHORIZED');
    });

    it('23505 with email in message maps to CONFLICT_EMAIL_EXISTS', () => {
      const pgError = { code: '23505', message: 'duplicate key value violates unique constraint on email' };
      const result = classifyError(pgError);
      expect(result.code).toBe('CONFLICT_EMAIL_EXISTS');
    });

    it('23505 without email maps to SVR_DATABASE', () => {
      const pgError = { code: '23505', message: 'duplicate key value violates unique constraint' };
      const result = classifyError(pgError);
      expect(result.code).toBe('SVR_DATABASE');
    });

    it('23503 maps to NF_* based on context', () => {
      const pgError = { code: '23503', message: 'foreign key violation' };
      const result = classifyError(pgError, { resource: 'student' });
      expect(result.code).toBe('NF_STUDENT');
    });

    it('unknown Postgrest code maps to SVR_DATABASE', () => {
      const pgError = { code: 'PGRST999', message: 'some error' };
      const result = classifyError(pgError);
      expect(result.code).toBe('SVR_DATABASE');
    });
  });

  describe('AuthError-like objects', () => {
    it('__isAuthError: true with Invalid login credentials', () => {
      const authError = { __isAuthError: true, message: 'Invalid login credentials' };
      const result = classifyError(authError);
      expect(result.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('AuthApiError name with email not confirmed', () => {
      const authError = { name: 'AuthApiError', message: 'Email not confirmed' };
      const result = classifyError(authError);
      expect(result.code).toBe('AUTH_EMAIL_NOT_CONFIRMED');
    });

    it('AuthError name with jwt expired', () => {
      const authError = { name: 'AuthError', message: 'jwt expired' };
      const result = classifyError(authError);
      expect(result.code).toBe('AUTH_SESSION_EXPIRED');
    });
  });

  describe('FunctionsHttpError-like objects', () => {
    it('FunctionsHttpError with context.error containing api_key', () => {
      const fnError = {
        name: 'FunctionsHttpError',
        message: 'Edge function error',
        context: { error: 'API_KEY not configured' },
      };
      const result = classifyError(fnError);
      expect(result.code).toBe('SVR_API_KEY_MISSING');
    });

    it('FunctionsHttpError with whisper api error', () => {
      const fnError = {
        name: 'FunctionsHttpError',
        message: 'Edge function error',
        context: { error: 'Whisper API error: something failed' },
      };
      const result = classifyError(fnError);
      expect(result.code).toBe('SVR_WHISPER_API');
    });

    it('FunctionsHttpError with unauthorized', () => {
      const fnError = {
        name: 'FunctionsHttpError',
        message: 'Edge function error',
        context: { error: 'Unauthorized' },
      };
      const result = classifyError(fnError);
      expect(result.code).toBe('AUTH_REQUIRED');
    });

    it('FunctionsHttpError with context.apiType fallback', () => {
      const fnError = {
        name: 'FunctionsHttpError',
        message: 'Edge function error',
        context: { error: 'Something went wrong' },
      };
      const result = classifyError(fnError, { apiType: 'tts' });
      expect(result.code).toBe('SVR_TTS_API');
    });

    it('FunctionsHttpError without context.apiType falls to SVR_UNKNOWN', () => {
      const fnError = {
        name: 'FunctionsHttpError',
        message: 'Edge function error',
        context: { error: 'Something went wrong' },
      };
      const result = classifyError(fnError);
      expect(result.code).toBe('SVR_UNKNOWN');
    });

    it('FunctionsRelayError is also recognized', () => {
      const fnError = {
        name: 'FunctionsRelayError',
        message: 'Relay failed',
        context: { error: 'TTS API error' },
      };
      const result = classifyError(fnError);
      expect(result.code).toBe('SVR_TTS_API');
    });
  });

  describe('Rate limit errors', () => {
    it('status 429 maps to RATE_* code', () => {
      const rateLimitError = { status: 429, message: 'Too many requests' };
      const result = classifyError(rateLimitError);
      expect(result.category).toBe('rate_limit');
    });

    it('status 429 with apiType context', () => {
      const rateLimitError = { status: 429, message: 'Too many requests', remaining: 0 };
      const result = classifyError(rateLimitError, { apiType: 'whisper' });
      expect(result.code).toBe('RATE_WHISPER');
    });

    it('status 429 with tts apiType context', () => {
      const rateLimitError = { status: 429, message: 'Too many requests' };
      const result = classifyError(rateLimitError, { apiType: 'tts' });
      expect(result.code).toBe('RATE_TTS');
    });

    it('status 429 with claude apiType context', () => {
      const rateLimitError = { status: 429, message: 'Too many requests' };
      const result = classifyError(rateLimitError, { apiType: 'claude' });
      expect(result.code).toBe('RATE_CLAUDE');
    });

    it('rate limit with reset_at generates dynamic message', () => {
      const futureDate = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const rateLimitError = {
        status: 429,
        message: 'rate limited',
        remaining: 0,
        reset_at: futureDate,
      };
      const result = classifyError(rateLimitError, { apiType: 'whisper' });
      expect(result.code).toBe('RATE_WHISPER');
      expect(result.userMessage).toContain('분 후');
    });

    it('rate limit infers whisper from message when no apiType', () => {
      const rateLimitError = { status: 429, message: 'whisper rate exceeded' };
      const result = classifyError(rateLimitError);
      expect(result.code).toBe('RATE_WHISPER');
    });

    it('rate limit infers tts from message when no apiType', () => {
      const rateLimitError = { status: 429, message: 'tts rate exceeded' };
      const result = classifyError(rateLimitError);
      expect(result.code).toBe('RATE_TTS');
    });

    it('rate limit infers claude from message when no apiType', () => {
      const rateLimitError = { status: 429, message: 'claude rate exceeded' };
      const result = classifyError(rateLimitError);
      expect(result.code).toBe('RATE_CLAUDE');
    });
  });

  describe('Network errors', () => {
    it('TypeError with "Network request failed" maps to NETWORK_OFFLINE', () => {
      const err = new TypeError('Network request failed');
      const result = classifyError(err);
      expect(result.code).toBe('NETWORK_OFFLINE');
    });

    it('TypeError with "Failed to fetch" maps to NETWORK_OFFLINE', () => {
      const err = new TypeError('Failed to fetch');
      const result = classifyError(err);
      expect(result.code).toBe('NETWORK_OFFLINE');
    });

    it('TypeError with "timeout" in message maps to NETWORK_TIMEOUT', () => {
      const err = new TypeError('Network timeout');
      const result = classifyError(err);
      expect(result.code).toBe('NETWORK_TIMEOUT');
    });

    it('TypeError with "aborted" maps to NETWORK_TIMEOUT', () => {
      const err = new TypeError('Network request aborted');
      const result = classifyError(err);
      expect(result.code).toBe('NETWORK_TIMEOUT');
    });
  });

  describe('Generic Error with unknown message', () => {
    it('unknown message without context maps to SVR_UNKNOWN', () => {
      const err = new Error('Something completely random');
      const result = classifyError(err);
      expect(result.code).toBe('SVR_UNKNOWN');
    });

    it('Error "not authenticated" maps to AUTH_REQUIRED', () => {
      const err = new Error('not authenticated');
      const result = classifyError(err);
      expect(result.code).toBe('AUTH_REQUIRED');
    });

    it('Error "unauthorized" maps to PERM_UNAUTHORIZED', () => {
      const err = new Error('unauthorized');
      const result = classifyError(err);
      expect(result.code).toBe('PERM_UNAUTHORIZED');
    });

    it('Error "practice not found" maps to NF_PRACTICE', () => {
      const err = new Error('practice not found');
      const result = classifyError(err);
      expect(result.code).toBe('NF_PRACTICE');
    });

    it('Error "script not found" maps to NF_SCRIPT', () => {
      const err = new Error('script not found');
      const result = classifyError(err);
      expect(result.code).toBe('NF_SCRIPT');
    });

    it('Error with microphone keyword maps to PERM_MIC_DENIED', () => {
      const err = new Error('microphone access denied');
      const result = classifyError(err);
      expect(result.code).toBe('PERM_MIC_DENIED');
    });

    it('Error with storage upload keyword maps to SVR_STORAGE_UPLOAD', () => {
      const err = new Error('storage upload failed');
      const result = classifyError(err);
      expect(result.code).toBe('SVR_STORAGE_UPLOAD');
    });
  });

  describe('context.resource and context.apiType affect classification', () => {
    it('generic Error with resource context maps to resource-specific NF_*', () => {
      const err = new Error('something failed');
      const result = classifyError(err, { resource: 'question' });
      expect(result.code).toBe('NF_QUESTION');
    });

    it('PGRST116 with resource=user maps to NF_USER', () => {
      const pgError = { code: 'PGRST116', message: 'Row not found' };
      const result = classifyError(pgError, { resource: 'user' });
      expect(result.code).toBe('NF_USER');
    });

    it('PGRST116 with resource=teacher maps to NF_TEACHER', () => {
      const pgError = { code: 'PGRST116', message: 'Row not found' };
      const result = classifyError(pgError, { resource: 'teacher' });
      expect(result.code).toBe('NF_TEACHER');
    });

    it('PGRST116 with resource=connection maps to NF_CONNECTION', () => {
      const pgError = { code: 'PGRST116', message: 'Row not found' };
      const result = classifyError(pgError, { resource: 'connection' });
      expect(result.code).toBe('NF_CONNECTION');
    });

    it('PGRST116 with resource=notification maps to NF_NOTIFICATION', () => {
      const pgError = { code: 'PGRST116', message: 'Row not found' };
      const result = classifyError(pgError, { resource: 'notification' });
      expect(result.code).toBe('NF_NOTIFICATION');
    });

    it('PGRST116 with resource=audio maps to NF_AUDIO_FILE', () => {
      const pgError = { code: 'PGRST116', message: 'Row not found' };
      const result = classifyError(pgError, { resource: 'audio' });
      expect(result.code).toBe('NF_AUDIO_FILE');
    });

    it('FunctionsHttpError with apiType=push maps to SVR_PUSH_API', () => {
      const fnError = {
        name: 'FunctionsHttpError',
        message: 'failed',
        context: { error: 'unknown error' },
      };
      const result = classifyError(fnError, { apiType: 'push' });
      expect(result.code).toBe('SVR_PUSH_API');
    });

    it('FunctionsHttpError with apiType=claude maps to SVR_CLAUDE_API', () => {
      const fnError = {
        name: 'FunctionsHttpError',
        message: 'failed',
        context: { error: 'random failure' },
      };
      const result = classifyError(fnError, { apiType: 'claude' });
      expect(result.code).toBe('SVR_CLAUDE_API');
    });
  });

  describe('object with error/message string fields', () => {
    it('{ error: string } delegates to classifyRpcError', () => {
      const result = classifyError({ error: 'ALREADY_CONNECTED' });
      expect(result.code).toBe('CONFLICT_ALREADY_CONNECTED');
    });

    it('{ message: string } creates Error and classifies', () => {
      const result = classifyError({ message: 'script not found' });
      expect(result.code).toBe('NF_SCRIPT');
    });
  });

  describe('non-standard inputs', () => {
    it('number returns SVR_UNKNOWN', () => {
      const result = classifyError(42 as any);
      expect(result.code).toBe('SVR_UNKNOWN');
    });

    it('boolean returns SVR_UNKNOWN', () => {
      const result = classifyError(true as any);
      expect(result.code).toBe('SVR_UNKNOWN');
    });
  });
});

// ============================================================================
// classifyAuthError()
// ============================================================================
describe('classifyAuthError()', () => {
  it('"Invalid login credentials" maps to AUTH_INVALID_CREDENTIALS', () => {
    const result = classifyAuthError({ message: 'Invalid login credentials' });
    expect(result.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('"Email not confirmed" maps to AUTH_EMAIL_NOT_CONFIRMED', () => {
    const result = classifyAuthError({ message: 'Email not confirmed' });
    expect(result.code).toBe('AUTH_EMAIL_NOT_CONFIRMED');
  });

  it('"User already registered" maps to CONFLICT_EMAIL_EXISTS', () => {
    const result = classifyAuthError({ message: 'User already registered' });
    expect(result.code).toBe('CONFLICT_EMAIL_EXISTS');
  });

  it('"jwt expired" maps to AUTH_SESSION_EXPIRED', () => {
    const result = classifyAuthError({ message: 'jwt expired' });
    expect(result.code).toBe('AUTH_SESSION_EXPIRED');
  });

  it('"password should be at least 6 characters" maps to VAL_PASSWORD_TOO_SHORT', () => {
    const result = classifyAuthError({ message: 'password should be at least 6 characters' });
    expect(result.code).toBe('VAL_PASSWORD_TOO_SHORT');
  });

  it('"invalid claim: missing sub claim" maps to AUTH_SESSION_EXPIRED', () => {
    const result = classifyAuthError({ message: 'invalid claim: missing sub claim' });
    expect(result.code).toBe('AUTH_SESSION_EXPIRED');
  });

  it('"refresh_token_not_found" maps to AUTH_SESSION_EXPIRED', () => {
    const result = classifyAuthError({ message: 'refresh_token_not_found' });
    expect(result.code).toBe('AUTH_SESSION_EXPIRED');
  });

  it('"token is expired or invalid" maps to AUTH_SESSION_EXPIRED', () => {
    const result = classifyAuthError({ message: 'token is expired or invalid' });
    expect(result.code).toBe('AUTH_SESSION_EXPIRED');
  });

  it('"user not found" maps to NF_USER', () => {
    const result = classifyAuthError({ message: 'user not found' });
    expect(result.code).toBe('NF_USER');
  });

  it('unknown auth error falls back to SVR_UNKNOWN', () => {
    const result = classifyAuthError({ message: 'some unknown auth error' });
    expect(result.code).toBe('SVR_UNKNOWN');
  });

  it('string input is handled', () => {
    const result = classifyAuthError('Invalid login credentials');
    expect(result.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('stores original error in metadata', () => {
    const original = { message: 'jwt expired', __isAuthError: true };
    const result = classifyAuthError(original);
    expect(result.metadata.originalError).toBe(original);
  });
});

// ============================================================================
// classifyRpcError()
// ============================================================================
describe('classifyRpcError()', () => {
  it('NOT_AUTHENTICATED maps to AUTH_REQUIRED', () => {
    expect(classifyRpcError('NOT_AUTHENTICATED').code).toBe('AUTH_REQUIRED');
  });

  it('INVALID_CODE maps to VAL_INVITE_CODE_INVALID', () => {
    expect(classifyRpcError('INVALID_CODE').code).toBe('VAL_INVITE_CODE_INVALID');
  });

  it('CODE_ALREADY_USED maps to CONFLICT_CODE_USED', () => {
    expect(classifyRpcError('CODE_ALREADY_USED').code).toBe('CONFLICT_CODE_USED');
  });

  it('ALREADY_CONNECTED maps to CONFLICT_ALREADY_CONNECTED', () => {
    expect(classifyRpcError('ALREADY_CONNECTED').code).toBe('CONFLICT_ALREADY_CONNECTED');
  });

  it('NOT_TEACHER maps to PERM_NOT_TEACHER', () => {
    expect(classifyRpcError('NOT_TEACHER').code).toBe('PERM_NOT_TEACHER');
  });

  it('NOT_STUDENT maps to PERM_NOT_STUDENT', () => {
    expect(classifyRpcError('NOT_STUDENT').code).toBe('PERM_NOT_STUDENT');
  });

  it('USER_NOT_FOUND maps to NF_USER', () => {
    expect(classifyRpcError('USER_NOT_FOUND').code).toBe('NF_USER');
  });

  it('TEACHER_NOT_FOUND maps to NF_TEACHER', () => {
    expect(classifyRpcError('TEACHER_NOT_FOUND').code).toBe('NF_TEACHER');
  });

  it('STUDENT_NOT_FOUND maps to NF_STUDENT', () => {
    expect(classifyRpcError('STUDENT_NOT_FOUND').code).toBe('NF_STUDENT');
  });

  it('NOT_CONNECTED maps to PERM_NOT_CONNECTED', () => {
    expect(classifyRpcError('NOT_CONNECTED').code).toBe('PERM_NOT_CONNECTED');
  });

  it('UNAUTHORIZED maps to PERM_UNAUTHORIZED', () => {
    expect(classifyRpcError('UNAUTHORIZED').code).toBe('PERM_UNAUTHORIZED');
  });

  it('INVALID_TYPE maps to PERM_UNAUTHORIZED', () => {
    expect(classifyRpcError('INVALID_TYPE').code).toBe('PERM_UNAUTHORIZED');
  });

  it('ADMIN_ONLY maps to PERM_ADMIN_ONLY', () => {
    expect(classifyRpcError('ADMIN_ONLY').code).toBe('PERM_ADMIN_ONLY');
  });

  it('ALREADY_TEACHER maps to CONFLICT_ALREADY_TEACHER', () => {
    expect(classifyRpcError('ALREADY_TEACHER').code).toBe('CONFLICT_ALREADY_TEACHER');
  });

  it('CANNOT_CHANGE_ADMIN maps to CONFLICT_ADMIN_PROTECTED', () => {
    expect(classifyRpcError('CANNOT_CHANGE_ADMIN').code).toBe('CONFLICT_ADMIN_PROTECTED');
  });

  it('handles case-insensitive input (uppercases internally)', () => {
    expect(classifyRpcError('not_authenticated').code).toBe('AUTH_REQUIRED');
  });

  it('handles whitespace-padded input', () => {
    expect(classifyRpcError('  INVALID_CODE  ').code).toBe('VAL_INVITE_CODE_INVALID');
  });

  it('NOT_FOUND with resource context maps to resource-specific code', () => {
    const result = classifyRpcError('NOT_FOUND', { resource: 'script' });
    expect(result.code).toBe('NF_SCRIPT');
  });

  it('RESOURCE_NOT_FOUND with resource context maps to resource-specific code', () => {
    const result = classifyRpcError('RESOURCE_NOT_FOUND', { resource: 'practice' });
    expect(result.code).toBe('NF_PRACTICE');
  });

  it('NOT_FOUND without context maps to SVR_DATABASE', () => {
    const result = classifyRpcError('NOT_FOUND');
    expect(result.code).toBe('SVR_DATABASE');
  });

  it('unknown RPC string maps to SVR_UNKNOWN', () => {
    const result = classifyRpcError('SOMETHING_UNKNOWN');
    expect(result.code).toBe('SVR_UNKNOWN');
  });

  it('stores original error string in metadata', () => {
    const result = classifyRpcError('INVALID_CODE');
    expect(result.metadata.originalError).toBe('INVALID_CODE');
  });
});

// ============================================================================
// getUserMessage()
// ============================================================================
describe('getUserMessage()', () => {
  it('AppError returns userMessage (Korean)', () => {
    const err = new AppError('AUTH_REQUIRED');
    expect(getUserMessage(err)).toBe('로그인이 필요합니다');
  });

  it('AppError.withMessage returns custom message', () => {
    const err = AppError.withMessage('RATE_WHISPER', '커스텀 메시지');
    expect(getUserMessage(err)).toBe('커스텀 메시지');
  });

  it('Regular Error returns its message', () => {
    const err = new Error('Something went wrong');
    expect(getUserMessage(err)).toBe('Something went wrong');
  });

  it('string returns the string itself', () => {
    expect(getUserMessage('hello')).toBe('hello');
  });

  it('null returns SVR_UNKNOWN message', () => {
    expect(getUserMessage(null)).toBe(ERROR_MESSAGES.SVR_UNKNOWN);
  });

  it('undefined returns SVR_UNKNOWN message', () => {
    expect(getUserMessage(undefined)).toBe(ERROR_MESSAGES.SVR_UNKNOWN);
  });

  it('number returns SVR_UNKNOWN message', () => {
    expect(getUserMessage(42 as any)).toBe(ERROR_MESSAGES.SVR_UNKNOWN);
  });

  it('empty object returns SVR_UNKNOWN message', () => {
    expect(getUserMessage({} as any)).toBe(ERROR_MESSAGES.SVR_UNKNOWN);
  });
});

// ============================================================================
// handleError()
// ============================================================================
describe('handleError()', () => {
  beforeEach(() => {
    (Alert.alert as jest.Mock).mockClear();
  });

  it('non-inline error calls Alert.alert with Korean message', () => {
    handleError(new AppError('AUTH_REQUIRED'));
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith('오류', '로그인이 필요합니다');
  });

  it('inline (validation) error does NOT call Alert.alert', () => {
    handleError(new AppError('VAL_EMAIL_REQUIRED'));
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('returns AppError', () => {
    const result = handleError(new Error('random'));
    expect(result).toBeInstanceOf(AppError);
  });

  it('classifies non-AppError input before handling', () => {
    const result = handleError('INVALID_CODE');
    expect(result).toBeInstanceOf(AppError);
    expect(result.code).toBe('VAL_INVITE_CODE_INVALID');
    // VAL_INVITE_CODE_INVALID is validation -> inline -> no alert
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('network error (banner display) triggers Alert.alert', () => {
    const err = new TypeError('Network request failed');
    const result = handleError(err);
    expect(result.code).toBe('NETWORK_OFFLINE');
    expect(result.displayMethod).toBe('banner');
    expect(Alert.alert).toHaveBeenCalledWith('오류', ERROR_MESSAGES.NETWORK_OFFLINE);
  });

  it('server error (toast_error display) triggers Alert.alert', () => {
    const result = handleError(null);
    expect(result.code).toBe('SVR_UNKNOWN');
    expect(Alert.alert).toHaveBeenCalledWith('오류', ERROR_MESSAGES.SVR_UNKNOWN);
  });

  it('conflict error (toast_warning display) triggers Alert.alert', () => {
    const result = handleError(new AppError('CONFLICT_EMAIL_EXISTS'));
    expect(Alert.alert).toHaveBeenCalledWith('오류', ERROR_MESSAGES.CONFLICT_EMAIL_EXISTS);
  });

  it('passes context through to classifyError', () => {
    const pgError = { code: 'PGRST116', message: 'Row not found' };
    const result = handleError(pgError, { resource: 'script' });
    expect(result.code).toBe('NF_SCRIPT');
  });

  it('all validation error codes produce no Alert', () => {
    const valCodes: ErrorCode[] = [
      'VAL_EMAIL_REQUIRED',
      'VAL_EMAIL_INVALID',
      'VAL_PASSWORD_REQUIRED',
      'VAL_PASSWORD_TOO_SHORT',
      'VAL_PASSWORD_MISMATCH',
      'VAL_NAME_REQUIRED',
      'VAL_SCRIPT_EMPTY',
      'VAL_INVITE_CODE_LENGTH',
      'VAL_INVITE_CODE_INVALID',
      'VAL_INVITE_CODE_EXPIRED',
    ];

    for (const code of valCodes) {
      (Alert.alert as jest.Mock).mockClear();
      handleError(new AppError(code));
      expect(Alert.alert).not.toHaveBeenCalled();
    }
  });
});

// ============================================================================
// isAppError()
// ============================================================================
describe('isAppError()', () => {
  it('returns true for AppError', () => {
    expect(isAppError(new AppError('SVR_UNKNOWN'))).toBe(true);
  });

  it('returns false for regular Error', () => {
    expect(isAppError(new Error('test'))).toBe(false);
  });

  it('returns false for null', () => {
    expect(isAppError(null)).toBe(false);
  });

  it('returns false for string', () => {
    expect(isAppError('test')).toBe(false);
  });

  it('returns false for plain object', () => {
    expect(isAppError({ code: 'SVR_UNKNOWN' })).toBe(false);
  });
});

// ============================================================================
// getDisplayMethod()
// ============================================================================
describe('getDisplayMethod()', () => {
  it('returns displayMethod for AppError', () => {
    expect(getDisplayMethod(new AppError('NETWORK_OFFLINE'))).toBe('banner');
    expect(getDisplayMethod(new AppError('AUTH_REQUIRED'))).toBe('alert');
    expect(getDisplayMethod(new AppError('VAL_EMAIL_REQUIRED'))).toBe('inline');
    expect(getDisplayMethod(new AppError('CONFLICT_EMAIL_EXISTS'))).toBe('toast_warning');
    expect(getDisplayMethod(new AppError('NF_SCRIPT'))).toBe('toast_error');
  });

  it('returns toast_error for non-AppError', () => {
    expect(getDisplayMethod(new Error('test'))).toBe('toast_error');
    expect(getDisplayMethod(null)).toBe('toast_error');
    expect(getDisplayMethod('string')).toBe('toast_error');
  });
});

// ============================================================================
// CATEGORY_CONFIG completeness
// ============================================================================
describe('CATEGORY_CONFIG', () => {
  it('every ErrorCategory has displayMethod and isRetryable', () => {
    const allCategories = Object.values(ERROR_CATEGORIES);
    for (const cat of allCategories) {
      const config = CATEGORY_CONFIG[cat];
      expect(config).toBeDefined();
      expect(typeof config.displayMethod).toBe('string');
      expect(typeof config.isRetryable).toBe('boolean');
    }
  });
});
