// Fetch Google Sheets data and emit public/plan.json for static hosting (GitHub Pages)
import fs from 'fs'
import path from 'path'
import { google } from 'googleapis'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env then .env.local if present
dotenv.config()
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })
dotenv.config({ path: path.join(__dirname, '..', 'env.local') })

const SHEET_ID = process.env.SHEET_ID
const PROJECT_ID = process.env.GOOGLE_PROJECT_ID
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

if (!SHEET_ID || !PROJECT_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
  console.error('[fetch-plan] Missing required environment variables.')
  process.exit(1)
}

const tabs = ['plans', 'phases', 'workouts', 'exercises']

const jwt = new google.auth.JWT({
  email: CLIENT_EMAIL,
  key: PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  subject: CLIENT_EMAIL
})

const sheets = google.sheets({ version: 'v4', auth: jwt })

async function fetchTab(tabName) {
  const range = `${tabName}!A:Z`
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range
  })
  const rows = res.data.values || []
  if (!rows.length) return []
  const headers = rows[0].map(h => h.trim())
  return rows.slice(1).map((row) => {
    const obj = {}
    headers.forEach((header, idx) => {
      obj[header] = (row[idx] ?? '').toString().trim()
    })
    return obj
  }).filter(row => Object.values(row).some(v => v !== ''))
}

const toNumber = (value, fallback = 0) => {
  if (value === undefined || value === null || value === '') return fallback
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

const toBool = (value) => {
  if (typeof value === 'boolean') return value
  return String(value).toLowerCase() === 'true'
}

const cleanText = (value = '') => value.toString().trim()

function transformPlan(data) {
  const byPlan = data.plans.map(plan => ({
    id: plan.plan_id,
    name: plan.plan_name,
    active: toBool(plan.active),
    phases: []
  }))

  const phasesByPlan = data.phases.reduce((acc, phase) => {
    const key = phase.plan_id
    acc[key] = acc[key] || []
    acc[key].push(phase)
    return acc
  }, {})

  const workoutsByPhase = data.workouts.reduce((acc, workout) => {
    const key = workout.phase_id
    acc[key] = acc[key] || []
    acc[key].push(workout)
    return acc
  }, {})

  const exercisesByWorkout = data.exercises.reduce((acc, exercise) => {
    const key = exercise.workout_id
    acc[key] = acc[key] || []
    acc[key].push(exercise)
    return acc
  }, {})

  byPlan.forEach((plan) => {
    const phases = phasesByPlan[plan.id] || []
    plan.phases = phases
      .sort((a, b) => toNumber(a.phase_order) - toNumber(b.phase_order))
      .map((phase) => {
        const weeksMap = new Map()
        const workouts = (workoutsByPhase[phase.phase_id] || []).sort(
          (a, b) => toNumber(a.workout_order) - toNumber(b.workout_order)
        )

        workouts.forEach((workout) => {
          const wk = toNumber(workout.week_number)
          if (!weeksMap.has(wk)) weeksMap.set(wk, [])
          weeksMap.get(wk).push(workout)
        })

        const weeks = Array.from(weeksMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([weekNumber, weekWorkouts]) => ({
            week: weekNumber,
            workouts: weekWorkouts.map(wk => ({
              id: wk.workout_id,
              dayName: wk.day_name,
              order: toNumber(wk.workout_order),
              focus: wk.focus,
              exercises: (exercisesByWorkout[wk.workout_id] || [])
                .sort((a, b) => toNumber(a.order) - toNumber(b.order))
                .map(ex => ({
                  id: ex.exercise_id,
                  order: toNumber(ex.order),
                  group: cleanText(ex.group),
                  name: ex.name,
                  warmupSets: cleanText(ex.warmup_sets),
                  workingSets: cleanText(ex.working_sets),
                  reps: cleanText(ex.reps),
                  load: cleanText(ex.load),
                  rpe: cleanText(ex.rpe),
                  rest: cleanText(ex.rest),
                  subs: [
                    { name: cleanText(ex.sub1), link: cleanText(ex.sub1_link) },
                    { name: cleanText(ex.sub2), link: cleanText(ex.sub2_link) }
                  ].filter(sub => sub.name),
                  notes: cleanText(ex.notes),
                  link: cleanText(ex.link)
                }))
            }))
          }))

        return {
          id: phase.phase_id,
          name: phase.phase_name,
          order: toNumber(phase.phase_order),
          weeksCount: toNumber(phase.weeks_count),
          weeks
        }
      })
  })

  return { plans: byPlan }
}

async function main() {
  console.log('[fetch-plan] Fetching tabs...')
  const [plans, phases, workouts, exercises] = await Promise.all(tabs.map(fetchTab))

  const payload = transformPlan({ plans, phases, workouts, exercises })
  const outDir = path.join(__dirname, '..', 'public')
  const outPath = path.join(outDir, 'plan.json')

  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(
    outPath,
    JSON.stringify({ updatedAt: new Date().toISOString(), ...payload }, null, 2),
    'utf8'
  )
  console.log(`[fetch-plan] Wrote ${outPath}`)
}

main().catch((err) => {
  console.error('[fetch-plan] Failed:', err?.message || err)
  process.exit(1)
})
