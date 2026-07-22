export interface HapticsAdapter {
  confirm(): void;
}

export const browserHaptics: HapticsAdapter = {
  confirm() {
    if ('vibrate' in navigator) navigator.vibrate?.(8);
  },
};

export const noOpHaptics: HapticsAdapter = { confirm() {} };
