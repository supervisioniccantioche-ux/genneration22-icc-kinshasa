import { GENERATIONS, type DemoState, type DemoValidationIssue } from './types.ts'
import { selectLeaderGenerations } from './selectors.ts'

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function validateDemoState(state: DemoState): DemoValidationIssue[] {
  const issues: DemoValidationIssue[] = []
  const validateDate = (entityId: string, field: string, value?: string) => {
    if (value !== undefined && !isValidIsoDate(value)) issues.push({ code: 'invalid_iso_date', entityId, message: `La date « ${field} » doit être une date ISO valide (AAAA-MM-JJ).` })
  }
  validateDate('demo-state', 'referenceDate', state.referenceDate)
  const structures = new Map(state.structures.map((item) => [item.id, item]))
  const people = new Map(state.people.map((item) => [item.id, item]))
  const leaders = new Map(state.leaders.map((item) => [item.id, item]))
  const leadersByPerson = new Map(state.leaders.map((item) => [item.personId, item]))
  const actionIds = new Set(state.actions.map((item) => item.id))
  const decisionIds = new Set(state.decisions.map((item) => item.id))
  const personOrRootExists = (id: string) => id === state.institutionalRoot.id || people.has(id)
  const uniqueIds = [
    state.structures.map((item) => item.id), state.people.map((item) => item.id), state.leaders.map((item) => item.id),
    state.relations.map((item) => item.id), state.actions.map((item) => item.id), state.alerts.map((item) => item.id),
    state.decisions.map((item) => item.id), [state.institutionalRoot.id],
  ].flat()
  const allIds = new Set<string>()
  for (const id of uniqueIds) {
    if (allIds.has(id)) issues.push({ code: 'duplicate_id', entityId: id, message: `L’identifiant « ${id} » est utilisé plusieurs fois.` })
    allIds.add(id)
  }

  for (const structure of state.structures) {
    if (structure.parentId && !structures.has(structure.parentId)) issues.push({ code: 'missing_structure_parent', entityId: structure.id, message: `La structure parente « ${structure.parentId} » n’existe pas.` })
    if (structure.type === 'zone' && structure.parentId) issues.push({ code: 'invalid_zone_parent', entityId: structure.id, message: 'Une zone est une racine et ne peut pas avoir de parent.' })
    if (structure.type === 'pole' && (!structure.parentId || structures.get(structure.parentId)?.type !== 'zone')) issues.push({ code: 'invalid_pole_parent', entityId: structure.id, message: 'Un pôle doit être rattaché à une zone existante.' })
    if (structure.type === 'community' && (!structure.parentId || structures.get(structure.parentId)?.type !== 'pole')) issues.push({ code: 'invalid_community_parent', entityId: structure.id, message: 'Une communauté doit être rattachée à un pôle existant.' })
  }

  for (const person of state.people) {
    if (!structures.has(person.zoneId) || structures.get(person.zoneId)?.type !== 'zone') issues.push({ code: 'missing_person_zone', entityId: person.id, message: `La zone « ${person.zoneId} » est absente ou de type incorrect.` })
    if (!structures.has(person.poleId) || structures.get(person.poleId)?.type !== 'pole') issues.push({ code: 'missing_person_pole', entityId: person.id, message: `Le pôle « ${person.poleId} » est absent ou de type incorrect.` })
    if (!structures.has(person.communityId) || structures.get(person.communityId)?.type !== 'community') issues.push({ code: 'missing_person_community', entityId: person.id, message: `La communauté « ${person.communityId} » est absente ou de type incorrect.` })
    const community = structures.get(person.communityId)
    const pole = structures.get(person.poleId)
    if (community?.parentId !== person.poleId || pole?.parentId !== person.zoneId) issues.push({ code: 'person_structure_mismatch', entityId: person.id, message: 'La communauté, le pôle et la zone de la personne ne suivent pas la hiérarchie définie.' })
    validateDate(person.id, 'dateEntered', person.dateEntered)
    if (!personOrRootExists(person.responsibleId)) issues.push({ code: 'missing_person_responsible', entityId: person.id, message: `Le responsable « ${person.responsibleId} » n’existe pas.` })
    if (person.responsibleId === person.id) issues.push({ code: 'self_responsible', entityId: person.id, message: 'Une personne ne peut pas être son propre responsable.' })
  }

  const leaderPersonIds = new Set<string>()
  for (const leader of state.leaders) {
    validateDate(leader.id, 'validationDate', leader.validationDate)
    if (!people.has(leader.personId)) issues.push({ code: 'missing_leader_person', entityId: leader.id, message: `La personne « ${leader.personId} » du leader n’existe pas.` })
    if (leaderPersonIds.has(leader.personId)) issues.push({ code: 'duplicate_leader_person', entityId: leader.id, message: 'Une personne ne peut avoir qu’une fiche leader.' })
    leaderPersonIds.add(leader.personId)
    if (leader.coachId && !personOrRootExists(leader.coachId)) issues.push({ code: 'missing_leader_coach', entityId: leader.id, message: `Le coach « ${leader.coachId} » n’existe pas.` })
    if (leader.coachId === leader.personId) issues.push({ code: 'self_coaching', entityId: leader.id, message: 'Un leader ne peut pas être son propre coach.' })
    if (leader.rootGeneration && leader.rootGeneration !== 'G1') issues.push({ code: 'invalid_root_generation', entityId: leader.id, message: 'Une source opérationnelle doit être en G1.' })
  }

  const duplicateRelations = new Set<string>()
  const activePotentialOwners = new Map<string, Set<string>>()
  for (const relation of state.relations) {
    validateDate(relation.id, 'startDate', relation.startDate)
    validateDate(relation.id, 'endDate', relation.endDate)
    if (!leaders.has(relation.leaderId)) issues.push({ code: 'missing_relation_leader', entityId: relation.id, message: `Le leader « ${relation.leaderId} » n’existe pas.` })
    if (!people.has(relation.potentialId)) issues.push({ code: 'missing_relation_potential', entityId: relation.id, message: `Le potentiel « ${relation.potentialId} » n’existe pas.` })
    const leaderPersonId = leaders.get(relation.leaderId)?.personId
    if (leaderPersonId && leaderPersonId === relation.potentialId) issues.push({ code: 'self_development', entityId: relation.id, message: 'Un leader ne peut pas s’accompagner lui-même.' })
    if (relation.status === 'active') {
      const key = `${relation.leaderId}:${relation.potentialId}`
      if (duplicateRelations.has(key)) issues.push({ code: 'duplicate_active_relation', entityId: relation.id, message: 'Une relation active identique existe déjà.' })
      duplicateRelations.add(key)
      const owners = activePotentialOwners.get(relation.potentialId) ?? new Set<string>()
      owners.add(relation.leaderId)
      activePotentialOwners.set(relation.potentialId, owners)
    }
  }
  for (const [potentialId, owners] of activePotentialOwners) {
    if (owners.size > 1) issues.push({ code: 'multiple_active_coaches', entityId: potentialId, message: 'Ce potentiel a plusieurs accompagnateurs actifs sans règle de partage définie.' })
  }
  for (const leader of state.leaders) {
    const activePotentials = new Set(state.relations.filter((relation) => relation.leaderId === leader.id && relation.status === 'active').map((relation) => relation.potentialId))
    if (activePotentials.size > 3) issues.push({ code: 'too_many_active_potentials', entityId: leader.id, message: 'Un leader ne peut pas dépasser trois potentiels actifs dans ce référentiel.' })
  }

  const adjacency = new Map<string, string[]>()
  for (const relation of state.relations) {
    const from = leaders.get(relation.leaderId)?.personId
    if (from && people.has(relation.potentialId)) adjacency.set(from, [...(adjacency.get(from) ?? []), relation.potentialId])
  }
  const visited = new Set<string>()
  const inPath = new Set<string>()
  const reportedCycles = new Set<string>()
  const visit = (personId: string) => {
    if (inPath.has(personId)) {
      if (!reportedCycles.has(personId)) issues.push({ code: 'development_cycle', entityId: personId, message: 'Un cycle a été détecté dans la chaîne de développement.' })
      reportedCycles.add(personId)
      return
    }
    if (visited.has(personId)) return
    visited.add(personId)
    inPath.add(personId)
    for (const childId of adjacency.get(personId) ?? []) visit(childId)
    inPath.delete(personId)
  }
  for (const person of state.people) visit(person.id)

  for (const action of state.actions) {
    validateDate(action.id, 'createdAt', action.createdAt)
    validateDate(action.id, 'dueDate', action.dueDate)
    validateDate(action.id, 'completedAt', action.completedAt)
    if (!people.has(action.personId)) issues.push({ code: 'missing_action_person', entityId: action.id, message: `La personne de l’action « ${action.personId} » n’existe pas.` })
    if (!personOrRootExists(action.responsibleId)) issues.push({ code: 'missing_action_responsible', entityId: action.id, message: `Le responsable de l’action « ${action.responsibleId} » n’existe pas.` })
    if (action.status === 'completed' && !action.completedAt) issues.push({ code: 'completed_action_without_date', entityId: action.id, message: 'Une action terminée doit avoir une date de réalisation.' })
  }

  for (const alert of state.alerts) {
    validateDate(alert.id, 'createdAt', alert.createdAt)
    validateDate(alert.id, 'dueDate', alert.dueDate)
    const exists = alert.entityType === 'person' ? people.has(alert.entityId)
      : alert.entityType === 'leader' ? leaders.has(alert.entityId)
        : alert.entityType === 'action' ? actionIds.has(alert.entityId)
          : decisionIds.has(alert.entityId)
    if (!exists) issues.push({ code: 'missing_alert_entity', entityId: alert.id, message: `L’entité liée à l’alerte « ${alert.entityId} » n’existe pas.` })
    if (!personOrRootExists(alert.responsibleId)) issues.push({ code: 'missing_alert_responsible', entityId: alert.id, message: `Le responsable de l’alerte « ${alert.responsibleId} » n’existe pas.` })
  }

  for (const decision of state.decisions) {
    validateDate(decision.id, 'dueDate', decision.dueDate)
    if (decision.progress < 0 || decision.progress > 100) issues.push({ code: 'invalid_decision_progress', entityId: decision.id, message: 'La progression d’une décision doit être comprise entre 0 et 100.' })
    if (!structures.has(decision.structureId)) issues.push({ code: 'missing_decision_structure', entityId: decision.id, message: `La structure de la décision « ${decision.structureId} » n’existe pas.` })
    if (!people.has(decision.ownerId)) issues.push({ code: 'missing_decision_owner', entityId: decision.id, message: `Le responsable de la décision « ${decision.ownerId} » n’existe pas.` })
  }

  const generationByPerson = selectLeaderGenerations(state)
  for (const leader of state.leaders) {
    if (generationByPerson.has(leader.personId)) continue
    const hasIncoming = state.relations.some((relation) => relation.status === 'active' && relation.potentialId === leader.personId)
    if (hasIncoming) {
      const parent = state.relations.find((relation) => relation.status === 'active' && relation.potentialId === leader.personId)
      const parentPersonId = parent ? leaders.get(parent.leaderId)?.personId : undefined
      const parentGeneration = parentPersonId ? generationByPerson.get(parentPersonId) : undefined
      if (parentGeneration === GENERATIONS[GENERATIONS.length - 1]) issues.push({ code: 'generation_beyond_g4', entityId: leader.id, message: 'Cette relation créerait une génération au-delà de G4.' })
      else if (state.relations.filter((relation) => relation.status === 'active' && relation.potentialId === leader.personId).length > 1) issues.push({ code: 'ambiguous_generation_parent', entityId: leader.id, message: 'La génération ne peut pas être calculée tant que plusieurs accompagnateurs actifs sont définis.' })
      else if (!parentGeneration) issues.push({ code: 'unresolved_generation', entityId: leader.id, message: 'La génération du leader ne peut pas être dérivée de la filiation actuelle.' })
    } else if (!leader.rootGeneration) {
      issues.push({ code: 'missing_generation_root', entityId: leader.id, message: 'Un leader sans parent doit être déclaré explicitement comme source G1.' })
    }
  }

  return issues
}
