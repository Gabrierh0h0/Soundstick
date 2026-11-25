export const LIMITS = {
  maxVideoMB: 50,
  maxSeconds: 10,
  minSeconds: 0.5,
  outputSize: 512,
} as const

export const MAX_VIDEO_BYTES = LIMITS.maxVideoMB * 1024 * 1024
