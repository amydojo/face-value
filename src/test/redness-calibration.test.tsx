import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  REDNESS_CALIBRATION_STORAGE_KEY,
  loadRednessCalibrationData,
} from '../adapters/persistence/rednessCalibrationStore';
import { RednessCalibration } from '../features/calibration-redness/RednessCalibration';

const FIXED_NOW = '2026-08-01T12:00:00.000Z';
const now = () => FIXED_NOW;

describe('protected redness calibration instrument', () => {
  it('renders an accessible provider-blocked and explicitly synthetic empty state', () => {
    render(<RednessCalibration now={now} />);

    expect(screen.getByRole('heading', { name: 'Redness calibration' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Live collection unavailable' })).toBeVisible();
    expect(screen.getByText(/HTTP 400/)).toHaveTextContent('CreditInsufficiency');
    expect(
      screen.getByRole('button', { name: 'LIVE THREE-FRAME CAPTURE UNAVAILABLE' }),
    ).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'Deterministic verification data' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Calibration dashboard' })).toBeVisible();
    expect(screen.getByText('No calibration observations stored.')).toBeVisible();
    expect(screen.getByLabelText('Canonical export')).toHaveValue('');
    expect(screen.getByLabelText('Face-free observation import')).toHaveValue('');
    expect(screen.getByRole('status')).toHaveTextContent('No live provider request has been made');
  });

  it('loads, inspects, and exports deterministic face-free evidence without touching other stores', async () => {
    const user = userEvent.setup();
    localStorage.setItem('face-value:phase-b5', 'ordinary-byte-sentinel');
    localStorage.setItem('face-value:demo-lab:v1', 'demo-byte-sentinel');
    render(<RednessCalibration now={now} />);

    await user.click(screen.getByRole('button', { name: 'LOAD COMPLETE SYNTHETIC DATASET' }));

    expect(loadRednessCalibrationData().status).toBe('ready');
    expect(screen.getAllByText('PRELIMINARY INTERNAL ESTIMATE')).toHaveLength(8);
    expect(screen.getByRole('heading', { name: 'Technical N95' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Longitudinal N95' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'ICC(A,1)' })).toBeVisible();
    expect(screen.getByText(/detectable boundary 5, strong boundary 10/)).toBeVisible();
    expect(screen.getByText('syn-p01-degraded')).toBeVisible();
    expect(screen.getByText('syn-p02-intervention')).toBeVisible();
    expect(screen.getByText(/No automated skin-tone inference is used/)).toBeVisible();

    await user.selectOptions(screen.getByLabelText('Inspect observation'), 'syn-p01-standard-a');
    const session = document.querySelector('[data-observation="syn-p01-standard-a"]');
    expect(session).not.toBeNull();
    const sessionQueries = within(session as HTMLElement);
    expect(sessionQueries.getByText('60 · 61 · 62')).toBeVisible();
    await user.click(sessionQueries.getByText('Version metadata and unavailable fields'));
    expect(sessionQueries.getAllByText('Not available').length).toBeGreaterThanOrEqual(4);
    expect(sessionQueries.getByText('Measured skin-tone audit group')).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: 'PREPARE FACE-FREE OBSERVATION EXPORT' }),
    );
    const exported = (screen.getByLabelText('Canonical export') as HTMLTextAreaElement).value;
    expect(exported).toContain('face-value-redness-calibration-export-v1');
    expect(exported).toContain('synthetic_face_free_fixture');
    expect(exported).not.toMatch(
      /data:image|blob:|https?:\/\/|provider.?task|raw.?payload|base64|image.?bytes|object.?url|email/i,
    );
    expect(localStorage.getItem('face-value:phase-b5')).toBe('ordinary-byte-sentinel');
    expect(localStorage.getItem('face-value:demo-lab:v1')).toBe('demo-byte-sentinel');
  });

  it('requires confirmation to replace or clear only isolated calibration storage', async () => {
    const user = userEvent.setup();
    localStorage.setItem('face-value:phase-b5', 'ordinary-byte-sentinel');
    localStorage.setItem('face-value:demo-lab:v1', 'demo-byte-sentinel');
    render(<RednessCalibration now={now} />);
    await user.click(screen.getByRole('button', { name: 'LOAD COMPLETE SYNTHETIC DATASET' }));

    await user.click(screen.getByRole('button', { name: 'CLEAR CALIBRATION DATA' }));
    const dialog = screen.getByRole('dialog', { name: 'Clear all redness calibration data?' });
    expect(dialog).toBeVisible();
    expect(localStorage.getItem(REDNESS_CALIBRATION_STORAGE_KEY)).not.toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'CANCEL' }));
    expect(localStorage.getItem(REDNESS_CALIBRATION_STORAGE_KEY)).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'CLEAR CALIBRATION DATA' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'CONFIRM CALIBRATION DATA CHANGE',
      }),
    );
    expect(localStorage.getItem(REDNESS_CALIBRATION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('face-value:phase-b5')).toBe('ordinary-byte-sentinel');
    expect(localStorage.getItem('face-value:demo-lab:v1')).toBe('demo-byte-sentinel');
    expect(screen.getByRole('status')).toHaveTextContent('Consumer and Demo Lab storage were not changed');
  });

  it('fails closed on corrupt durable data and leaves the original bytes quarantined', () => {
    const corruptBytes = '{"schemaVersion":"future-calibration-v99","observations":[]}';
    localStorage.setItem(REDNESS_CALIBRATION_STORAGE_KEY, corruptBytes);

    render(<RednessCalibration now={now} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Calibration data quarantined');
    expect(screen.getByRole('alert')).toHaveTextContent('unsupported_schema_version');
    expect(screen.queryByRole('heading', { name: 'Calibration dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Canonical export')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'LOAD COMPLETE SYNTHETIC DATASET' })).toBeDisabled();
    expect(localStorage.getItem(REDNESS_CALIBRATION_STORAGE_KEY)).toBe(corruptBytes);
  });
});
