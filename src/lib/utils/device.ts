/**
 * Centralized device detection utilities.
 */

// Strict iOS detection using only UserAgent strings for iPhone, iPad, and iPod.
export const isIOS =
  typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent);

/**
 * Returns true if the device is a mobile device (iOS or Android).
 */
export const isMobile =
  typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
