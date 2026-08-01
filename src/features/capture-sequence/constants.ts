export const CAPTURE_TIMING = {
  enterInvalidMs: 150,
  returnValidMs: 250,
  loseLockMs: 300,
  validHoldMs: 500,
  guideConnectionMs: 280,
  mechanicalPauseMs: 450,
  scanMs: 900,
  reducedMotionScanMs: 300,
  captureFreezeMs: 120,
  shutterMs: 160,
  capturedGuideHoldMs: 150,
  capturedGuideResolveMs: 360,
  scanCompleteDwellMs: 1_800,
  analysisCrossfadeMs: 225,
  analysisProgressMinimumMs: 700,
  analysisConfirmationHoldMs: 800,
  analysisNoProgressMs: 6_000,
  analysisIndicatorCycleMs: 1_800,
  analysisFieldCycleMs: 2_800,
  persistentLowLightMs: 8_000,
  breathingMs: 2_200,
} as const;

export const CAPTURE_GEOMETRY = {
  viewportWidth: 390,
  viewportHeight: 780,
  viewportRadius: 28,
  guideFrameWidth: 330,
  guideFrameHeight: 450,
  guideOvalWidth: 312,
  guideOvalHeight: 432,
  guideInsetX: 9,
  guideInsetY: 9,
  guideOffsetX: 30,
  guideOffsetY: 132,
  railWidth: 358,
  railHeight: 48,
  railOffsetX: 16,
  railOffsetBottom: 16,
  railRadius: 13,
  minimumOccupancy: 0.68,
  idealOccupancy: 0.78,
  maximumOccupancy: 0.86,
} as const;

export const CAMERA_KIT_ACQUISITION_MS =
  CAPTURE_TIMING.returnValidMs +
  CAPTURE_TIMING.validHoldMs +
  CAPTURE_TIMING.guideConnectionMs +
  CAPTURE_TIMING.mechanicalPauseMs +
  CAPTURE_TIMING.scanMs +
  20;
