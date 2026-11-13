import type { DemoAddPersonInput, DemoState } from './types.ts'

export type DemoStoreAction =
  | { type: 'person.add'; payload: DemoAddPersonInput }
  | { type: 'action.toggle'; id: string }

export function demoReducer(state: DemoState, action: DemoStoreAction): DemoState {
  if (action.type === 'person.add') {
    const input = action.payload
    const id = `person-demo-${state.nextPersonSequence}`
    const responsibleId = state.leaders.find((leader) => leader.activityStatus === 'active')?.personId ?? state.institutionalRoot.id
    const community = state.structures.find((structure) => structure.id === input.communityId && structure.type === 'community')
    const pole = community?.parentId ? state.structures.find((structure) => structure.id === community.parentId) : undefined
    const zone = pole?.parentId ? state.structures.find((structure) => structure.id === pole.parentId) : undefined
    const person = {
      id,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
      ...(input.email?.trim() ? { email: input.email.trim().toLowerCase() } : {}),
      communityId: community?.id ?? 'community-gombe-a',
      poleId: pole?.id ?? 'pole-gombe-centre',
      zoneId: zone?.id ?? 'zone-gombe',
      responsibleId,
      integrationStatus: input.integrationStatus,
      leadershipStatus: input.leadershipStatus,
      dateEntered: state.referenceDate,
      active: true,
      color: ['sage', 'blue', 'rose', 'gold', 'lavender', 'peach', 'mint', 'sand'][state.nextPersonSequence % 8],
    }
    return { ...state, people: [person, ...state.people], nextPersonSequence: state.nextPersonSequence + 1 }
  }
  if (action.type === 'action.toggle') {
    return {
      ...state,
      actions: state.actions.map((item) => item.id === action.id
        ? item.status === 'completed'
          ? { ...item, status: 'open', completedAt: undefined }
          : { ...item, status: 'completed', completedAt: state.referenceDate }
        : item),
    }
  }
  return state
}
