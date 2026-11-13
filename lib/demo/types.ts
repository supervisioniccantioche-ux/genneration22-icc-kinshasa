export const GENERATIONS = ['G1', 'G2', 'G3', 'G4'] as const
export type Generation = (typeof GENERATIONS)[number]

export type IntegrationStatus = 'contact' | 'visitor' | 'integrated'
export type LeadershipStatus = 'none' | 'identified' | 'observed' | 'accompanied' | 'tested' | 'responsibilized' | 'evaluated'
export type RelationshipStatus = 'active' | 'paused' | 'completed'
export type AlertSeverity = 'critical' | 'attention' | 'information'
export type AlertEntityType = 'person' | 'leader' | 'action' | 'decision'

export interface DemoPerson {
  id: string
  firstName: string
  lastName: string
  phone?: string
  email?: string
  photoUrl?: string
  zoneId: string
  poleId: string
  communityId: string
  responsibleId: string
  integrationStatus: IntegrationStatus
  leadershipStatus: LeadershipStatus
  dateEntered: string
  active: boolean
  color: string
}

export interface DemoLeader {
  id: string
  personId: string
  validationDate: string
  activityStatus: 'active' | 'inactive'
  responsibility: string
  coachId?: string
  rootGeneration?: Generation
}

export interface DevelopmentRelation {
  id: string
  leaderId: string
  potentialId: string
  startDate: string
  status: RelationshipStatus
  endDate?: string
}

export interface DemoAction {
  id: string
  personId: string
  responsibleId: string
  type: string
  title: string
  dueDate: string
  status: 'open' | 'completed'
  createdAt: string
  completedAt?: string
}

export interface DemoAlert {
  id: string
  type: string
  severity: AlertSeverity
  entityType: AlertEntityType
  entityId: string
  responsibleId: string
  status: 'open' | 'resolved'
  title: string
  description: string
  createdAt: string
  dueDate?: string
}

export interface DemoStructure {
  id: string
  name: string
  type: 'zone' | 'pole' | 'community'
  parentId?: string
}

export interface GovernanceDecision {
  id: string
  title: string
  structureId: string
  ownerId: string
  dueDate: string
  status: 'open' | 'in_progress' | 'completed'
  progress: number
}

export interface StrategicReference {
  baseline: { day: 'J0'; integratedMembers: number; activeLeaders: number }
  target: { integratedMembers: number; activeLeaders: number }
  milestones: Array<{ day: 'J0' | 'J30' | 'J60' | 'J90'; integratedMembers: number; activeLeaders: number }>
}

export interface DemoState {
  referenceDate: string
  institutionalRoot: { id: string; name: string }
  strategic: StrategicReference
  structures: DemoStructure[]
  people: DemoPerson[]
  leaders: DemoLeader[]
  relations: DevelopmentRelation[]
  actions: DemoAction[]
  alerts: DemoAlert[]
  decisions: GovernanceDecision[]
  nextPersonSequence: number
}

export interface DemoRelationSummary {
  id: string
  potentialPersonId: string
  name: string
  leadershipStage: string
  status: RelationshipStatus
}

export interface DemoPersonView extends DemoPerson {
  name: string
  initials: string
  role: string
  generation: Generation | '—'
  status: string
  coach: string
  parentLeaderName: string
  next: string
  due: string
  zone: string
  progress: number
  activePotentialCount: number
  developmentRelations: DemoRelationSummary[]
}

export interface DemoActionView extends DemoAction {
  person: string
  date: string
  priority: string
  done: boolean
}

export interface DemoAlertView extends DemoAlert {
  level: string
  text: string
  detail: string
  owner: string
  when: string
  initials: string
  color: string
}

export interface DemoValidationIssue {
  code: string
  entityId: string
  message: string
}

export interface DemoAddPersonInput {
  firstName: string
  lastName: string
  phone?: string
  email?: string
  communityId: string
  integrationStatus: IntegrationStatus
  leadershipStatus: LeadershipStatus
}
