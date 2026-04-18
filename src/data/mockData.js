export const PIPELINE_STAGES = [
  { status: 'Home Coming',       color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)', index: 0  },
  { status: 'Call Confirmation', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)',  index: 1  },
  { status: 'Interview',         color: '#6366f1', bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.3)',  index: 2  },
  { status: 'Selected',          color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)',  border: 'rgba(14,165,233,0.3)',  index: 3  },
  { status: 'Offer Letter',      color: '#eab308', bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.3)',   index: 4  },
  { status: 'Documentation',     color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)',  index: 5  },
  { status: 'Medical',           color: '#ec4899', bg: 'rgba(236,72,153,0.12)',  border: 'rgba(236,72,153,0.3)',  index: 6  },
  { status: 'Passport',          color: '#a855f7', bg: 'rgba(168,85,247,0.12)',  border: 'rgba(168,85,247,0.3)',  index: 7  },
  { status: 'Visa Process',      color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.3)',  index: 8  },
  { status: 'Flight Ticket',     color: '#14b8a6', bg: 'rgba(20,184,166,0.12)',  border: 'rgba(20,184,166,0.3)',  index: 9  },
  { status: 'Take Off',          color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   border: 'rgba(6,182,212,0.3)',   index: 10 },
  { status: 'Onboard',           color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)',   index: 11 },
]

export const getStage = (status) =>
  PIPELINE_STAGES.find((s) => s.status === status) || PIPELINE_STAGES[0]

export const CATEGORIES = ['Engineering', 'IT', 'Oil & Gas', 'Non-Technical']

export const INTERVIEW_TYPES = [
  'Phone Screening',
  'Technical',
  'HR Round',
  'Final',
  'Client Interview',
]

export const DOC_TYPES = [
  'Offer Letter',
  'Medical Report',
  'Passport Copy',
  'Visa Copy',
  'Flight Ticket',
  'ID Proof',
  'Education Certificate',
  'Experience Letter',
]

export const initialProjects = []

export const initialCandidates = []

export const ATTEND_STATUSES = [
  'Shortlist',
  'Mail Sent',
  'Informed Day Before',
  'On the Morning',
  '1 Hr Before',
  'Selected',
  'Rejected',
]

export const initialInterviews = []
