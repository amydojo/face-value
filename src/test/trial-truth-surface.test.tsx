import { useReducer } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FaceValueContext } from '../app/faceValueContext';
import { faceValueReducer, type TrialTruthFaceValueState } from '../app/trialTruthMachine';
import { ordinaryDemoRuntime } from '../domain/demoLab';
import { buildDemoFixtureState } from '../features/demo-lab/demoFixtureState';
import { TrialTruthSurface } from '../features/trial-truth/TrialTruthSurface';

function Harness() {
  const [state, dispatch] = useReducer(
    faceValueReducer,
    buildDemoFixtureState('trial_truth', 'clear_favorable_change') as TrialTruthFaceValueState,
  );
  return (
    <FaceValueContext.Provider value={{ state, dispatch, demoRuntime: ordinaryDemoRuntime }}>
      <TrialTruthSurface />
    </FaceValueContext.Provider>
  );
}

describe('TrialTruthSurface', () => {
  it('announces groups and starts without a favorable selection', () => {
    render(<Harness />);
    expect(screen.getByRole('group', { name: 'USED AS PLANNED?' })).toBeVisible();
    expect(screen.getByRole('group', { name: 'SKIN RESPONSE?' })).toBeVisible();
    expect(screen.getByRole('group', { name: 'VISIBLE REDNESS TO YOU?' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Yes' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'None' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Less' })).not.toBeChecked();
  });

  it('announces missing answers and reveals reachable symptom controls', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /CONTINUE TO RESULT/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('Complete the missing evidence.');

    await user.click(screen.getByRole('radio', { name: 'Moderate' }));
    expect(screen.getByRole('group', { name: 'WHAT DID YOU NOTICE?' })).toBeVisible();
    const swelling = screen.getByRole('checkbox', { name: 'Swelling' });
    swelling.focus();
    expect(swelling).toHaveFocus();
    await user.click(swelling);
    expect(swelling).toBeChecked();
  });
});
