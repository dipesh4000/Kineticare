/**
 * Central Error-Mapping Module for Kineticare.
 * Maps low-level system, camera, model, WebGL, auth, and database errors
 * into human-readable messages with clear, actionable recovery guidance.
 * Never exposes raw stack traces or internal error codes directly to users.
 */

export const ERROR_CATEGORIES = {
  CAMERA: 'camera',
  MODEL: 'model',
  NETWORK: 'network',
  DATABASE: 'database',
  AUTH: 'auth',
  RUNTIME: 'runtime',
};

const ERROR_MAP = {
  // --- Camera Errors ---
  NotAllowedError: {
    category: ERROR_CATEGORIES.CAMERA,
    message: 'Camera permission was denied.',
    action: 'Allow camera access in your browser address bar (lock/camera icon) and click Retry.',
    retryable: true,
  },
  PermissionDeniedError: {
    category: ERROR_CATEGORIES.CAMERA,
    message: 'Camera permission was denied.',
    action: 'Allow camera access in your browser settings and click Retry.',
    retryable: true,
  },
  NotFoundError: {
    category: ERROR_CATEGORIES.CAMERA,
    message: 'No camera was detected on this device.',
    action: 'Connect or enable a webcam, check your hardware connection, and click Retry.',
    retryable: true,
  },
  DevicesNotFoundError: {
    category: ERROR_CATEGORIES.CAMERA,
    message: 'No camera was detected on this device.',
    action: 'Connect a webcam and click Retry.',
    retryable: true,
  },
  NotReadableError: {
    category: ERROR_CATEGORIES.CAMERA,
    message: 'Camera is currently in use by another application or locked by your operating system.',
    action: 'Close other apps using your camera (Zoom, Teams, Meet) and click Retry.',
    retryable: true,
  },
  TrackStartError: {
    category: ERROR_CATEGORIES.CAMERA,
    message: 'Camera failed to start.',
    action: 'Close background apps using the camera and click Retry.',
    retryable: true,
  },
  OverconstrainedError: {
    category: ERROR_CATEGORIES.CAMERA,
    message: 'Requested camera resolution or frame rate is not supported by your camera hardware.',
    action: 'Switching to standard resolution. Click Retry to continue.',
    retryable: true,
  },
  DeviceDisconnected: {
    category: ERROR_CATEGORIES.CAMERA,
    message: 'The camera stream ended unexpectedly (device unplugged or disconnected).',
    action: 'Reconnect your camera and click Reconnect.',
    retryable: true,
  },
  TabHiddenPause: {
    category: ERROR_CATEGORIES.CAMERA,
    message: 'Tracking paused while the browser tab was hidden.',
    action: 'Tab is active again. Click Resume to continue.',
    retryable: true,
  },

  // --- Model & Hardware Acceleration Errors ---
  WEBGL_CONTEXT_LOST: {
    category: ERROR_CATEGORIES.MODEL,
    message: 'Graphics acceleration (WebGL) was interrupted or lost.',
    action: 'Falling back to CPU/WASM processing mode to keep tracking active.',
    retryable: true,
  },
  WASM_FALLBACK: {
    category: ERROR_CATEGORIES.MODEL,
    message: 'WebGL acceleration is unavailable. Running on lightweight CPU mode.',
    action: 'Fast mode is active for reduced CPU usage.',
    retryable: false,
  },
  UNSUPPORTED_DEVICE: {
    category: ERROR_CATEGORIES.MODEL,
    message: 'Your browser or device does not support on-device pose estimation.',
    action: 'Please update your browser to the latest version or try Chrome/Edge with hardware acceleration enabled.',
    retryable: false,
  },
  MODEL_DOWNLOAD_TIMEOUT: {
    category: ERROR_CATEGORIES.MODEL,
    message: 'Movement model files took too long to download.',
    action: 'Check your internet connection. Retrying with backoff or switch to Fast mode.',
    retryable: true,
  },

  // --- Auth Errors ---
  'auth/invalid-email': {
    category: ERROR_CATEGORIES.AUTH,
    message: 'The email address format is invalid.',
    action: 'Check your email address and re-enter it.',
    retryable: true,
  },
  'auth/user-disabled': {
    category: ERROR_CATEGORIES.AUTH,
    message: 'This account has been disabled.',
    action: 'Contact your clinician or clinic administrator for support.',
    retryable: false,
  },
  'auth/user-not-found': {
    category: ERROR_CATEGORIES.AUTH,
    message: 'No account found with this email address.',
    action: 'Check your email or register a new patient account.',
    retryable: true,
  },
  'auth/wrong-password': {
    category: ERROR_CATEGORIES.AUTH,
    message: 'Incorrect password entered.',
    action: 'Check your password and try again, or use password reset.',
    retryable: true,
  },
  'auth/invalid-credential': {
    category: ERROR_CATEGORIES.AUTH,
    message: 'Invalid login credentials.',
    action: 'Verify your login details and retry.',
    retryable: true,
  },
  'auth/email-already-in-use': {
    category: ERROR_CATEGORIES.AUTH,
    message: 'An account with this email address already exists.',
    action: 'Sign in instead with your existing account.',
    retryable: true,
  },
  'auth/network-request-failed': {
    category: ERROR_CATEGORIES.AUTH,
    message: 'Network connection was lost during sign-in.',
    action: 'Check your internet connection and try again.',
    retryable: true,
  },

  // --- Database / Save Errors ---
  'permission-denied': {
    category: ERROR_CATEGORIES.DATABASE,
    message: 'Permission denied to save or access this clinical record.',
    action: 'Ensure you are signed in with the correct patient account.',
    retryable: true,
  },
  PERMISSION_DENIED: {
    category: ERROR_CATEGORIES.DATABASE,
    message: 'Permission denied to save or access this clinical record.',
    action: 'Ensure you are signed in with the correct patient account.',
    retryable: true,
  },
  unavailable: {
    category: ERROR_CATEGORIES.DATABASE,
    message: 'The server database is temporarily unreachable.',
    action: 'Your workout draft is saved locally on this device. Click Retry Save when connected.',
    retryable: true,
  },
  UNAVAILABLE: {
    category: ERROR_CATEGORIES.DATABASE,
    message: 'The server database is temporarily unreachable.',
    action: 'Your workout draft is saved locally on this device. Click Retry Save when connected.',
    retryable: true,
  },
  'not-found': {
    category: ERROR_CATEGORIES.DATABASE,
    message: 'The requested plan or record could not be found on the server.',
    action: 'Return to your home plan or refresh your workspace.',
    retryable: true,
  },
  'deadline-exceeded': {
    category: ERROR_CATEGORIES.DATABASE,
    message: 'The server took too long to complete the save operation.',
    action: 'Your draft is safely preserved. Click Retry Save.',
    retryable: true,
  },
};

/**
 * Maps any error object, string, or exception into a user-facing error descriptor.
 */
export function mapError(error) {
  if (!error) {
    return {
      code: 'UNKNOWN',
      category: ERROR_CATEGORIES.RUNTIME,
      message: 'An unexpected issue occurred.',
      action: 'Please refresh the page or retry.',
      retryable: true,
    };
  }

  // Extract candidate code or name
  const name = error.name || '';
  const code = error.code || '';
  const rawMessage = error.message || (typeof error === 'string' ? error : '');

  // Exact code match
  if (ERROR_MAP[code]) {
    return { code, ...ERROR_MAP[code] };
  }

  // Exact name match
  if (ERROR_MAP[name]) {
    return { code: name, ...ERROR_MAP[name] };
  }

  // Substring checks on message / name
  if (/NotAllowedError|Permission denied/i.test(name) || /permission.*denied/i.test(rawMessage)) {
    return { code: 'NotAllowedError', ...ERROR_MAP.NotAllowedError };
  }
  if (/NotFoundError|DevicesNotFound/i.test(name) || /no camera/i.test(rawMessage)) {
    return { code: 'NotFoundError', ...ERROR_MAP.NotFoundError };
  }
  if (/NotReadableError|TrackStartError/i.test(name) || /in use|could not start/i.test(rawMessage)) {
    return { code: 'NotReadableError', ...ERROR_MAP.NotReadableError };
  }
  if (/OverconstrainedError/i.test(name) || /constraints/i.test(rawMessage)) {
    return { code: 'OverconstrainedError', ...ERROR_MAP.OverconstrainedError };
  }
  if (/webgl.*lost|context lost/i.test(rawMessage) || /webgl.*lost/i.test(name)) {
    return { code: 'WEBGL_CONTEXT_LOST', ...ERROR_MAP.WEBGL_CONTEXT_LOST };
  }
  if (/unsupported.*device|webgl.*unavailable/i.test(rawMessage)) {
    return { code: 'UNSUPPORTED_DEVICE', ...ERROR_MAP.UNSUPPORTED_DEVICE };
  }
  if (/timeout|took too long/i.test(rawMessage)) {
    return { code: 'MODEL_DOWNLOAD_TIMEOUT', ...ERROR_MAP.MODEL_DOWNLOAD_TIMEOUT };
  }
  if (/network|fetch failed|offline/i.test(rawMessage)) {
    return {
      code: 'NETWORK_OFFLINE',
      category: ERROR_CATEGORIES.NETWORK,
      message: 'Internet connection appears offline or interrupted.',
      action: 'Check your Wi-Fi or mobile data. Your session draft is safe locally.',
      retryable: true,
    };
  }

  // Safe fallback: never expose raw stack or cryptic objects
  return {
    code: code || name || 'GENERAL_ERROR',
    category: ERROR_CATEGORIES.RUNTIME,
    message: typeof rawMessage === 'string' && rawMessage.length < 100 && !rawMessage.includes('at ')
      ? rawMessage
      : 'A technical issue occurred while processing your request.',
    action: 'Click Retry or return to your plan. In-progress data has been drafted locally.',
    retryable: true,
  };
}
