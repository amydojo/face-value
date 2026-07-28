export type EvidenceRecordDisclosure = 'why' | 'full';

export interface EvidenceRecordDisclosureState {
  openDisclosure: EvidenceRecordDisclosure | null;
  technicalMetadataOpen: boolean;
}

export const collapsedEvidenceRecordDisclosureState: EvidenceRecordDisclosureState = {
  openDisclosure: null,
  technicalMetadataOpen: false,
};
