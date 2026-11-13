import assert from 'node:assert/strict'
import test from 'node:test'
import { initialDemoState } from './seed.ts'
import { dateValue, formatDemoDate, formatReferenceDate, selectActionFilter, selectActionViews, selectDemoMetrics, selectLeaderGenerations } from './selectors.ts'
import { validateDemoState } from './validation.ts'
import { demoReducer } from './store.ts'

test('le jeu de démonstration est cohérent et les identifiants sont uniques', () => {
  assert.deepEqual(validateDemoState(initialDemoState), [])
  const ids = [
    ...initialDemoState.people.map((item) => item.id),
    ...initialDemoState.leaders.map((item) => item.id),
    ...initialDemoState.relations.map((item) => item.id),
    ...initialDemoState.actions.map((item) => item.id),
    ...initialDemoState.alerts.map((item) => item.id),
    ...initialDemoState.decisions.map((item) => item.id),
    ...initialDemoState.structures.map((item) => item.id),
  ]
  assert.equal(new Set(ids).size, ids.length)
})

test('les générations sont dérivées des relations validées de G1 à G4', () => {
  const generations = selectLeaderGenerations(initialDemoState)
  assert.equal(generations.get('person-esther'), 'G1')
  assert.equal(generations.get('person-marie'), 'G2')
  assert.equal(generations.get('person-jonathan'), 'G3')
  assert.equal(generations.get('person-aline'), 'G4')
  assert.equal(generations.has('person-sarah'), false)
})

test('les potentiels courants ignorent les relations terminées', () => {
  const expected = new Set(initialDemoState.relations.filter((relation) => relation.status !== 'completed').map((relation) => relation.potentialId)).size
  assert.equal(selectDemoMetrics(initialDemoState).identifiedPotentials, expected)
})

test('un potentiel ne peut pas être compté comme leader validé sans entrée Leader', () => {
  const metrics = selectDemoMetrics(initialDemoState)
  assert.equal(metrics.validatedLeaders, 7)
  assert.equal(metrics.activeLeaders, 7)
  assert.equal(metrics.identifiedPotentials, 11)
  assert.equal(metrics.multipliers, 2)
})

test('les filtres Aujourd’hui, Cette semaine, En retard et Terminées filtrent les échéances réelles', () => {
  const actions = selectActionViews(initialDemoState)
  assert.deepEqual(selectActionFilter(actions, 'Aujourd’hui', initialDemoState.referenceDate).map((item) => item.id), ['action-jean-coaching'])
  assert.deepEqual(selectActionFilter(actions, 'En retard', initialDemoState.referenceDate).map((item) => item.id), ['action-marie-followup'])
  assert.deepEqual(selectActionFilter(actions, 'Terminées', initialDemoState.referenceDate).map((item) => item.id), ['action-esther-review'])
  assert.ok(selectActionFilter(actions, 'Cette semaine', initialDemoState.referenceDate).some((item) => item.id === 'action-sarah-feedback'))
  assert.ok(!selectActionFilter(actions, 'Cette semaine', initialDemoState.referenceDate).some((item) => item.id === 'action-paul-evaluation'))
})

test('date de référence et jours de la semaine correspondent au calendrier', () => {
  assert.equal(formatReferenceDate('2026-11-13'), 'VENDREDI 13 NOVEMBRE 2026')
  assert.equal(formatDemoDate('2026-11-14', '2026-11-13'), 'Demain')
  assert.equal(dateValue('2026-11-15') - dateValue('2026-11-13'), 2 * 86_400_000)
})

test('les objectifs J0 restent distincts de l’échantillon illustratif', () => {
  assert.deepEqual(initialDemoState.strategic.baseline, { day: 'J0', integratedMembers: 1000, activeLeaders: 50 })
  assert.deepEqual(initialDemoState.strategic.target, { integratedMembers: 3000, activeLeaders: 300 })
  assert.notEqual(selectDemoMetrics(initialDemoState).integratedMembers, initialDemoState.strategic.baseline.integratedMembers)
})

test('les validations signalent auto-accompagnement, cycle et relations en doublon', () => {
  const invalid = structuredClone(initialDemoState)
  invalid.relations.push({ id: 'relation-invalid-self', leaderId: 'leader-pierre', potentialId: 'person-pierre', startDate: initialDemoState.referenceDate, status: 'active' })
  invalid.relations.push({ id: 'relation-invalid-duplicate', leaderId: 'leader-pierre', potentialId: 'person-jean', startDate: initialDemoState.referenceDate, status: 'active' })
  invalid.relations.push({ id: 'relation-invalid-cycle', leaderId: 'leader-jonathan', potentialId: 'person-esther', startDate: initialDemoState.referenceDate, status: 'active' })
  const codes = validateDemoState(invalid).map((issue) => issue.code)
  assert.ok(codes.includes('self_development'))
  assert.ok(codes.includes('duplicate_active_relation'))
  assert.ok(codes.includes('development_cycle'))
})

test('les mutations de démonstration restent déterministes et limitées à la session', () => {
  const added = demoReducer(initialDemoState, {
    type: 'person.add',
    payload: { firstName: 'Test', lastName: 'Démo', communityId: 'community-gombe-a', integrationStatus: 'integrated', leadershipStatus: 'identified' },
  })
  assert.equal(added.people[0].id, 'person-demo-100')
  assert.equal(added.people[0].dateEntered, initialDemoState.referenceDate)
  assert.equal(initialDemoState.people.some((person) => person.id === 'person-demo-100'), false)

  const toggled = demoReducer(initialDemoState, { type: 'action.toggle', id: 'action-jean-coaching' })
  assert.equal(toggled.actions.find((action) => action.id === 'action-jean-coaching')?.status, 'completed')
  assert.equal(toggled.actions.find((action) => action.id === 'action-jean-coaching')?.completedAt, initialDemoState.referenceDate)
  assert.equal(initialDemoState.actions.find((action) => action.id === 'action-jean-coaching')?.status, 'open')
})

test('les dates invalides ou non ISO sont rejetées par le validateur', () => {
  const invalid = structuredClone(initialDemoState)
  invalid.actions[0].dueDate = '2026-11-31'
  assert.ok(validateDemoState(invalid).some((issue) => issue.code === 'invalid_iso_date' && issue.entityId === 'action-jean-coaching'))
})
