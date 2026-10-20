import { InspectionStatus } from './schemas/inspection.js';

export type InspectionTransition =
  | 'submit'
  | 'review'
  | 'reopen';

export const inspectionStateMachine: Record<
  InspectionStatus,
  { allowedTransitions: Record<InspectionTransition, InspectionStatus | null> }
> = {
  DRAFT: {
    allowedTransitions: {
      submit: 'SUBMITTED',
      review: null,
      reopen: null,
    },
  },
  SUBMITTED: {
    allowedTransitions: {
      submit: null,
      review: 'REVIEWED',
      reopen: 'REOPENED',
    },
  },
  REVIEWED: {
    allowedTransitions: {
      submit: null,
      review: null,
      reopen: 'REOPENED',
    },
  },
  REOPENED: {
    allowedTransitions: {
      submit: 'SUBMITTED',
      review: null,
      reopen: null,
    },
  },
};

export function canTransition(
  currentStatus: InspectionStatus,
  transition: InspectionTransition
): boolean {
  const nextStatus = inspectionStateMachine[currentStatus].allowedTransitions[transition];
  return nextStatus !== null;
}

export function applyTransition(
  currentStatus: InspectionStatus,
  transition: InspectionTransition
): InspectionStatus {
  const nextStatus = inspectionStateMachine[currentStatus].allowedTransitions[transition];
  if (nextStatus === null) {
    throw new Error(`Invalid transition ${transition} from status ${currentStatus}`);
  }
  return nextStatus;
}
