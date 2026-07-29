import type {
  CaptureInstructionCopy,
  CaptureIssue,
  CaptureQuality,
  CaptureRailState,
  CaptureSequenceState,
} from './types';

const issueCopy: Record<CaptureIssue, CaptureInstructionCopy> = {
  'face-missing': {
    primary: 'Position your face',
    secondary: 'Looking for a stable frame',
  },
  'position-face': {
    primary: 'Position your face',
    secondary: 'Center within the guide',
  },
  'too-close': {
    primary: 'Move slightly back',
    secondary: 'Keep your face inside the guide',
  },
  'too-far': {
    primary: 'Move slightly closer',
    secondary: 'Keep your face inside the guide',
  },
  'move-left': {
    primary: 'Move slightly left',
    secondary: 'Center within the guide',
  },
  'move-right': {
    primary: 'Move slightly right',
    secondary: 'Center within the guide',
  },
  'raise-face': {
    primary: 'Raise your face',
    secondary: 'Center within the guide',
  },
  'lower-face': {
    primary: 'Lower your face',
    secondary: 'Center within the guide',
  },
  'face-camera': {
    primary: 'Face the camera',
    secondary: 'Keep both sides of your face visible',
  },
  'level-head': {
    primary: 'Level your head',
    secondary: 'Keep both sides of your face visible',
  },
  'low-light': {
    primary: 'Move toward softer light',
    secondary: 'Keep your face evenly lit',
  },
  backlight: {
    primary: 'Avoid light behind you',
    secondary: 'Keep your face evenly lit',
  },
  'uneven-light': {
    primary: 'Move toward softer light',
    secondary: 'Keep your face evenly lit',
  },
  movement: {
    primary: 'Hold still',
    secondary: 'Keep the frame steady',
  },
};

export function getCaptureInstruction(state: CaptureSequenceState): CaptureInstructionCopy {
  if (state.phase === 'error') {
    if (state.failure === 'permission-denied') {
      return {
        primary: 'Camera access is needed',
        secondary: 'Enable camera access or choose a photo instead',
      };
    }
    return {
      primary: 'Camera unavailable',
      secondary: 'Choose an existing photo to continue',
    };
  }

  if (state.phase === 'captured') {
    return {
      primary: 'Baseline secured',
      secondary: 'Processing specimen',
    };
  }
  if (state.phase === 'scanning') {
    return {
      primary: 'Reading capture conditions',
      secondary: 'Securing baseline',
    };
  }
  if (state.phase === 'locking') {
    return { primary: 'Frame locked', secondary: 'Hold still' };
  }
  if (state.phase === 'searching') {
    return {
      primary: 'Position your face',
      secondary: 'Looking for a stable frame',
    };
  }
  if (state.persistentLowLight) {
    return {
      primary: 'Lighting is still too low',
      secondary: 'Try facing a window or choose a photo instead',
    };
  }
  if (state.frameLost && state.activeIssue === 'face-missing') {
    return { primary: 'Frame lost', secondary: 'Return to the guide' };
  }
  if (state.phase === 'aligning' && state.activeIssue === null) {
    return { primary: 'Hold still', secondary: 'Resolving stable frame' };
  }
  return issueCopy[state.activeIssue ?? 'face-missing'];
}

export function getHighestPriorityCaptureIssue(
  quality: CaptureQuality,
  specifics: Pick<
    CaptureSequenceState['latestSample'],
    'distanceIssue' | 'alignmentIssue' | 'angleIssue' | 'lightingIssue'
  >,
): CaptureIssue | null {
  if (!quality.facePresent) return 'face-missing';
  if (!quality.distanceValid) return specifics.distanceIssue ?? 'too-far';
  if (!quality.alignmentValid) {
    return specifics.alignmentIssue ?? 'position-face';
  }
  if (!quality.angleValid) return specifics.angleIssue ?? 'face-camera';
  if (!quality.lightingValid) {
    return specifics.lightingIssue ?? 'uneven-light';
  }
  if (!quality.stillnessValid) return 'movement';
  return null;
}

const categoryPassed = (
  category: 'light' | 'alignment' | 'stillness',
  quality: CaptureQuality,
): boolean => {
  if (category === 'light') return quality.lightingValid;
  if (category === 'stillness') return quality.stillnessValid;
  return (
    quality.facePresent && quality.distanceValid && quality.alignmentValid && quality.angleValid
  );
};

const issueCategory = (issue: CaptureIssue | null): 'light' | 'alignment' | 'stillness' | null => {
  if (!issue) return null;
  if (['low-light', 'backlight', 'uneven-light'].includes(issue)) {
    return 'light';
  }
  if (issue === 'movement') return 'stillness';
  return 'alignment';
};

export function getCaptureRailStates(
  state: CaptureSequenceState,
): Record<'light' | 'alignment' | 'stillness', CaptureRailState> {
  const current = issueCategory(state.activeIssue);
  const rail: Record<'light' | 'alignment' | 'stillness', CaptureRailState> = {
    light: categoryPassed('light', state.quality) ? 'passed' : 'pending',
    alignment: categoryPassed('alignment', state.quality) ? 'passed' : 'pending',
    stillness: categoryPassed('stillness', state.quality) ? 'passed' : 'pending',
  };

  if (current) rail[current] = 'current';
  return rail;
}
