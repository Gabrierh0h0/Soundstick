export const LIMITS = {
  maxVideoMB: 50,
  maxAudioMB: 10,
  maxImageMB: 5,
  maxSeconds: 10,
  minSeconds: 0.5,
  outputSize: 512,
  minSpeed: 0.5,
  maxSpeed: 2,
  maxFade: 2,
} as const

const MB = 1024 * 1024
export const MAX_VIDEO_BYTES = LIMITS.maxVideoMB * MB
export const MAX_AUDIO_BYTES = LIMITS.maxAudioMB * MB
export const MAX_IMAGE_BYTES = LIMITS.maxImageMB * MB
