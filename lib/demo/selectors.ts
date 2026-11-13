import { GENERATIONS, type DemoAction, type DemoActionView, type DemoAlertView, type DemoPerson, type DemoPersonView, type DemoState, type Generation, type GovernanceDecision } from './types.ts'

const leadershipLabels = {
  none: 'Membre intégré',
  identified: 'Repéré',
  observed: 'Observé',
  accompanied: 'Accompagné',
  tested: 'Testé',
  responsibilized: 'Responsabilisé',
  evaluated: 'Évalué',
} as const

const leadershipProgress = {
  none: 100,
  identified: 10,
  observed: 22,
  accompanied: 38,
  tested: 56,
  responsibilized: 72,
  evaluated: 88,
} as const

export const KPI_DEFINITIONS = {
  registeredPeople: 'Nombre de personnes présentes dans le référentiel, actives ou non.',
  contacts: 'Personnes dont le statut d’intégration est contact.',
  visitors: 'Personnes dont le statut d’intégration est visiteur.',
  integratedMembers: 'Personnes dont le statut d’intégration est intégré; indépendant du parcours leadership.',
  activeLeaders: 'Leaders ayant le statut d’activité actif.',
  identifiedPotentials: 'Personnes distinctes citées dans au moins une relation de développement.',
  accompaniedFutureLeaders: 'Potentiels avec une relation active et une étape accompagnée, testée, responsabilisée ou évaluée.',
  validatedLeaders: 'Personnes présentes dans le référentiel des leaders, actives ou non.',
  multipliers: 'Leaders actifs disposant exactement de trois relations actives vers des potentiels distincts.',
  generations: 'Leaders actifs répartis selon la génération dérivée de la filiation validée.',
  openActions: 'Actions au statut ouvert.',
  overdueActions: 'Actions ouvertes dont l’échéance est antérieure à la date de référence.',
  criticalAlerts: 'Alertes ouvertes de sévérité critique.',
  attentionAlerts: 'Alertes ouvertes de sévérité attention.',
  activeChains: 'Relations actives de développement entre un leader et un potentiel.',
  blockedChains: 'Alertes ouvertes de type chaîne bloquée.',
} as const

export interface DemoMetrics {
  registeredPeople: number
  contacts: number
  visitors: number
  integratedMembers: number
  activeLeaders: number
  identifiedPotentials: number
  activePotentialPeople: number
  accompaniedFutureLeaders: number
  validatedLeaders: number
  multipliers: number
  generationCounts: Record<Generation, number>
  openActions: number
  overdueActions: number
  criticalAlerts: number
  attentionAlerts: number
  informationAlerts: number
  resolvedAlerts: number
  activeChains: number
  blockedChains: number
  completeChains: number
  developingChains: number
}

export function dateValue(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getTime()
}

export function formatReferenceDate(date: string): string {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00.000Z`)).toLocaleUpperCase('fr-FR')
}

export function formatDemoDate(date: string, referenceDate: string): string {
  const diffDays = Math.round((dateValue(date) - dateValue(referenceDate)) / 86_400_000)
  if (diffDays === 0) return 'Aujourd’hui'
  if (diffDays === 1) return 'Demain'
  if (diffDays < 0) return `En retard · ${Math.abs(diffDays)} j`
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00.000Z`))
}

function buildEntityMaps(state: DemoState) {
  return {
    peopleById: new Map(state.people.map((person) => [person.id, person])),
    leadersById: new Map(state.leaders.map((leader) => [leader.id, leader])),
    leaderByPersonId: new Map(state.leaders.map((leader) => [leader.personId, leader])),
    structuresById: new Map(state.structures.map((structure) => [structure.id, structure])),
  }
}

export function selectLeaderGenerations(state: DemoState): Map<string, Generation> {
  const { leadersById } = buildEntityMaps(state)
  const result = new Map<string, Generation>()
  const visiting = new Set<string>()
  const resolve = (leaderId: string): Generation | undefined => {
    if (result.has(leaderId)) return result.get(leaderId)
    if (visiting.has(leaderId)) return undefined
    const leader = leadersById.get(leaderId)
    if (!leader) return undefined
    if (leader.rootGeneration) {
      if (leader.rootGeneration === 'G1') result.set(leaderId, 'G1')
      return leader.rootGeneration === 'G1' ? 'G1' : undefined
    }
    visiting.add(leaderId)
    const incoming = state.relations.filter((relation) => relation.potentialId === leader.personId && relation.status === 'active')
    if (incoming.length !== 1) {
      visiting.delete(leaderId)
      return undefined
    }
    const parentLeader = leadersById.get(incoming[0].leaderId)
    const parentGeneration = parentLeader ? resolve(parentLeader.id) : undefined
    visiting.delete(leaderId)
    if (!parentGeneration) return undefined
    const nextIndex = GENERATIONS.indexOf(parentGeneration) + 1
    if (nextIndex < 0 || nextIndex >= GENERATIONS.length) return undefined
    const generation = GENERATIONS[nextIndex]
    result.set(leaderId, generation)
    return generation
  }

  for (const leader of state.leaders) resolve(leader.id)
  return new Map([...result].map(([leaderId, generation]) => [leadersById.get(leaderId)?.personId ?? leaderId, generation]))
}

export function selectActivePotentialCount(state: DemoState, leaderId: string): number {
  return new Set(state.relations.filter((relation) => relation.leaderId === leaderId && relation.status === 'active').map((relation) => relation.potentialId)).size
}

export function selectActionViews(state: DemoState): DemoActionView[] {
  const peopleById = new Map(state.people.map((person) => [person.id, person]))
  return state.actions.map((action) => {
    const person = peopleById.get(action.personId)
    const overdue = action.status === 'open' && dateValue(action.dueDate) < dateValue(state.referenceDate)
    const daysUntilDue = Math.round((dateValue(action.dueDate) - dateValue(state.referenceDate)) / 86_400_000)
    return {
      ...action,
      person: person ? `${person.firstName} ${person.lastName}` : 'Personne inconnue',
      date: formatDemoDate(action.dueDate, state.referenceDate),
      priority: action.status === 'completed' ? 'Terminée' : overdue ? 'Urgent' : daysUntilDue <= 0 ? 'Prioritaire' : daysUntilDue <= 2 ? 'Important' : 'Normal',
      done: action.status === 'completed',
    }
  }).sort((a, b) => dateValue(a.dueDate) - dateValue(b.dueDate))
}

export function selectActionFilter(actions: DemoActionView[], filter: string, referenceDate: string): DemoActionView[] {
  const target = dateValue(referenceDate)
  const day = new Date(`${referenceDate}T00:00:00.000Z`).getUTCDay()
  const daysSinceMonday = (day + 6) % 7
  const weekStart = target - daysSinceMonday * 86_400_000
  const weekEnd = weekStart + 6 * 86_400_000
  if (filter === 'Terminées') return actions.filter((action) => action.status === 'completed')
  if (filter === 'En retard') return actions.filter((action) => action.status === 'open' && dateValue(action.dueDate) < target)
  if (filter === 'Aujourd’hui') return actions.filter((action) => action.status === 'open' && dateValue(action.dueDate) === target)
  if (filter === 'Cette semaine') return actions.filter((action) => action.status === 'open' && dateValue(action.dueDate) >= weekStart && dateValue(action.dueDate) <= weekEnd)
  return actions
}

export function selectPeopleViews(state: DemoState): DemoPersonView[] {
  const generations = selectLeaderGenerations(state)
  const { peopleById, leaderByPersonId, structuresById } = buildEntityMaps(state)
  const activeActions = selectActionViews(state).filter((action) => action.status === 'open')
  return state.people.map((person, index) => {
  const leader = leaderByPersonId.get(person.id)
  const activePotentialCount = leader ? selectActivePotentialCount(state, leader.id) : 0
  const incoming = state.relations.filter((relation) => relation.potentialId === person.id && relation.status !== 'completed')
  const parentLeader = incoming.length === 1 ? state.leaders.find((item) => item.id === incoming[0].leaderId) : undefined
  const hasDevelopmentRelation = incoming.length > 0
  const leadershipStage = person.leadershipStatus === 'none' && hasDevelopmentRelation ? 'identified' : person.leadershipStatus
  const developmentRelations = leader ? state.relations.filter((relation) => relation.leaderId === leader.id).map((relation) => {
    const potential = peopleById.get(relation.potentialId)
    return {
      id: relation.id,
      potentialPersonId: relation.potentialId,
      name: potential ? `${potential.firstName} ${potential.lastName}` : 'Référence invalide',
      leadershipStage: potential ? potential.leadershipStatus === 'none' ? 'Potentiel identifié' : leadershipLabels[potential.leadershipStatus] : 'Référence invalide',
      status: relation.status,
    }
  }) : []
    const responsible = person.responsibleId === state.institutionalRoot.id ? state.institutionalRoot.name : peopleById.get(person.responsibleId)
    const coach = leader?.coachId === state.institutionalRoot.id
      ? state.institutionalRoot.name
      : leader?.coachId
        ? peopleById.get(leader.coachId)
        : responsible
    const nextAction = activeActions.find((action) => action.personId === person.id)
  const leadershipLabel = leadershipLabels[leadershipStage]
  const status = leader
  ? activePotentialCount === 3 ? 'Multiplicateur' : 'Validé leader'
  : leadershipStage !== 'none' ? leadershipLabel
  : person.integrationStatus === 'contact' ? 'Contact'
  : person.integrationStatus === 'visitor' ? 'Visiteur' : 'Membre intégré'
  const role = leader
  ? activePotentialCount > 0 ? 'Leader · Coach' : 'Leader'
  : leadershipStage !== 'none' ? 'Futur leader'
  : person.integrationStatus === 'integrated' ? 'Membre intégré'
  : person.integrationStatus === 'visitor' ? 'Visiteur' : 'Contact'
  const progress = leader ? 100 : leadershipStage !== 'none' ? leadershipProgress[leadershipStage] : person.integrationStatus === 'integrated' ? 100 : 0
    const community = structuresById.get(person.communityId)
    const pole = community?.parentId ? structuresById.get(community.parentId) : undefined
    const zone = structuresById.get(person.zoneId)
    const name = `${person.firstName} ${person.lastName}`
    return {
      ...person,
      name,
      initials: `${person.firstName[0] ?? ''}${person.lastName[0] ?? ''}`.toUpperCase(),
      role,
      generation: generations.get(person.id) ?? '—',
      status,
      coach: typeof coach === 'string' ? coach : coach ? `${coach.firstName} ${coach.lastName}` : 'Non assigné',
      parentLeaderName: incoming.length > 1 ? 'Plusieurs leaders parents' : parentLeader ? peopleById.get(parentLeader.personId) ? `${peopleById.get(parentLeader.personId)!.firstName} ${peopleById.get(parentLeader.personId)!.lastName}` : 'Référence invalide' : 'Aucun leader parent actif',
      next: nextAction?.title ?? 'Aucune action planifiée',
      due: nextAction?.date ?? 'À planifier',
      zone: zone?.name ?? pole?.name ?? community?.name ?? 'Structure non renseignée',
      progress,
      activePotentialCount,
      developmentRelations,
      color: person.color || ['sage', 'blue', 'rose', 'gold', 'lavender', 'peach', 'mint', 'sand'][index % 8],
    }
  })
}

export function selectDemoMetrics(state: DemoState): DemoMetrics {
  const generationByPerson = selectLeaderGenerations(state)
  const activeLeaders = state.leaders.filter((leader) => leader.activityStatus === 'active')
  const generationCounts = Object.fromEntries(GENERATIONS.map((generation) => [generation, activeLeaders.filter((leader) => generationByPerson.get(leader.personId) === generation).length])) as Record<Generation, number>
  const activeRelations = state.relations.filter((relation) => relation.status === 'active')
  const uniquePotentials = new Set(state.relations.filter((relation) => relation.status !== 'completed').map((relation) => relation.potentialId))
  const accompaniedStatuses = new Set(['accompanied', 'tested', 'responsibilized', 'evaluated'])
  const activeActions = state.actions.filter((action) => action.status === 'open')
  const openAlerts = state.alerts.filter((alert) => alert.status === 'open')
  const completeChains = state.leaders.filter((leader) => leader.rootGeneration === 'G1' && hasGenerationDescendant(state, leader.personId, 'G4')).length
  const developingChains = state.leaders.filter((leader) => leader.rootGeneration === 'G1' && selectActivePotentialCount(state, leader.id) > 0 && !hasGenerationDescendant(state, leader.personId, 'G4')).length
  return {
    registeredPeople: state.people.length,
    contacts: state.people.filter((person) => person.integrationStatus === 'contact').length,
    visitors: state.people.filter((person) => person.integrationStatus === 'visitor').length,
    integratedMembers: state.people.filter((person) => person.integrationStatus === 'integrated').length,
    activeLeaders: activeLeaders.length,
    identifiedPotentials: uniquePotentials.size,
    activePotentialPeople: new Set(activeRelations.map((relation) => relation.potentialId)).size,
    accompaniedFutureLeaders: new Set(activeRelations.filter((relation) => {
      const potential = state.people.find((person) => person.id === relation.potentialId)
      return potential && accompaniedStatuses.has(potential.leadershipStatus)
    }).map((relation) => relation.potentialId)).size,
    validatedLeaders: state.leaders.length,
    multipliers: activeLeaders.filter((leader) => selectActivePotentialCount(state, leader.id) === 3).length,
    generationCounts,
    openActions: activeActions.length,
    overdueActions: activeActions.filter((action) => dateValue(action.dueDate) < dateValue(state.referenceDate)).length,
    criticalAlerts: openAlerts.filter((alert) => alert.severity === 'critical').length,
    attentionAlerts: openAlerts.filter((alert) => alert.severity === 'attention').length,
    informationAlerts: openAlerts.filter((alert) => alert.severity === 'information').length,
    resolvedAlerts: state.alerts.filter((alert) => alert.status === 'resolved').length,
    activeChains: activeRelations.length,
    blockedChains: openAlerts.filter((alert) => alert.type === 'blocked_chain').length,
    completeChains,
    developingChains,
  }
}

function hasGenerationDescendant(state: DemoState, rootPersonId: string, desiredGeneration: Generation): boolean {
  const generations = selectLeaderGenerations(state)
  if (![...generations].some(([personId, generation]) => personId === rootPersonId && generation === 'G1')) return false
  return [...generations].some(([personId, generation]) => generation === desiredGeneration && isDescendant(state, rootPersonId, personId))
}

function isDescendant(state: DemoState, ancestorPersonId: string, descendantPersonId: string): boolean {
  const leadersById = new Map(state.leaders.map((leader) => [leader.id, leader]))
  const visiting = new Set<string>()
  const visit = (personId: string): boolean => {
    if (personId === ancestorPersonId) return true
    if (visiting.has(personId)) return false
    visiting.add(personId)
    const parent = state.relations.find((relation) => relation.status === 'active' && relation.potentialId === personId)
    const parentPersonId = parent ? leadersById.get(parent.leaderId)?.personId : undefined
    return parentPersonId ? visit(parentPersonId) : false
  }
  return visit(descendantPersonId)
}

export function selectAlertViews(state: DemoState): DemoAlertView[] {
  const peopleById = new Map(state.people.map((person) => [person.id, person]))
  const leadersById = new Map(state.leaders.map((leader) => [leader.id, leader]))
  const actionsById = new Map(state.actions.map((action) => [action.id, action]))
  return state.alerts.map((alert) => {
    const relatedLeader = alert.entityType === 'leader' ? leadersById.get(alert.entityId) : undefined
    const relatedAction = alert.entityType === 'action' ? actionsById.get(alert.entityId) : undefined
    const relatedPersonId = alert.entityType === 'person' ? alert.entityId : relatedLeader?.personId ?? relatedAction?.personId
    const relatedPerson = relatedPersonId ? peopleById.get(relatedPersonId) : undefined
    const owner = alert.responsibleId === state.institutionalRoot.id ? state.institutionalRoot.name : peopleById.get(alert.responsibleId)
    return {
      ...alert,
      level: alert.severity === 'critical' ? 'Critique' : alert.severity === 'attention' ? 'Attention' : 'Information',
      text: alert.title,
      detail: alert.description,
      owner: owner ? typeof owner === 'string' ? owner : `${owner.firstName} ${owner.lastName}` : 'Responsable non renseigné',
      when: alert.dueDate ? formatDemoDate(alert.dueDate, state.referenceDate) : 'À surveiller',
      initials: relatedPerson ? `${relatedPerson.firstName[0]}${relatedPerson.lastName[0]}`.toUpperCase() : '2:2',
      color: relatedPerson?.color ?? 'sage',
    }
  })
}

export function selectDecisionViews(state: DemoState): Array<GovernanceDecision & { zone: string; owner: string; stateLabel: string; dueLabel: string }> {
  const structuresById = new Map(state.structures.map((structure) => [structure.id, structure]))
  const peopleById = new Map(state.people.map((person) => [person.id, person]))
  return state.decisions.map((decision) => {
    const owner = peopleById.get(decision.ownerId)
    return {
      ...decision,
      zone: structuresById.get(decision.structureId)?.name ?? 'Structure non renseignée',
      owner: owner ? `${owner.firstName} ${owner.lastName}` : 'Responsable non renseigné',
      stateLabel: decision.status === 'in_progress' ? 'En cours' : decision.status === 'completed' ? 'Terminée' : 'À traiter',
      dueLabel: formatDemoDate(decision.dueDate, state.referenceDate),
    }
  })
}

export function selectLeadershipStages(state: DemoState, metrics: DemoMetrics) {
  const count = (status: DemoPerson['leadershipStatus']) => state.people.filter((person) => person.leadershipStatus === status).length
  return [
    { name: 'Repérés', count: count('identified') },
    { name: 'Observés', count: count('observed') },
    { name: 'Accompagnés', count: count('accompanied') },
    { name: 'Testés', count: count('tested') },
    { name: 'Responsabilisés', count: count('responsibilized') },
    { name: 'Évalués', count: count('evaluated') },
    { name: 'Leaders', count: metrics.activeLeaders },
    { name: 'Multiplicateurs', count: metrics.multipliers },
  ].map((stage) => ({ ...stage, pct: metrics.registeredPeople ? Math.round(stage.count / metrics.registeredPeople * 100) : 0 }))
}

export function selectGenerationDepth(metrics: DemoMetrics): string {
  const total = Object.values(metrics.generationCounts).reduce((sum, count) => sum + count, 0)
  if (!total) return '0,0'
  const weighted = GENERATIONS.reduce((sum, generation, index) => sum + (index + 1) * metrics.generationCounts[generation], 0)
  return (weighted / total).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export function formatShortReferenceDate(date: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00.000Z`))
}

export function selectActivePotentialCountByPerson(state: DemoState, personId: string): number {
  const leader = state.leaders.find((item) => item.personId === personId)
  return leader ? selectActivePotentialCount(state, leader.id) : 0
}

export function getActionDaysFromReference(action: DemoAction, referenceDate: string): number {
  return Math.round((dateValue(action.dueDate) - dateValue(referenceDate)) / 86_400_000)
}
