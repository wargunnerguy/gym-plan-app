// Google Apps Script — deploy as Web App (Execute as: Me, Who has access: Anyone)
// Paste this entire file into the Apps Script editor bound to your spreadsheet.
// After deploying, paste the Web App URL into env.local as NUXT_PUBLIC_USERDATA_URL.

const SHEET_NAME = 'UserData'

function doGet(e) {
  try {
    const action = (e.parameter && e.parameter.action) || 'get'
    if (action === 'post') {
      return handleWrite(e.parameter)
    }
    return handleRead()
  } catch (err) {
    return json({ error: String(err) })
  }
}

// ── Read all rows and return structured data ──────────────────────────────────

function handleRead() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME)
  const values = sheet.getDataRange().getValues()

  // Find the most recent cycle-reset timestamp
  const PROGRESS_TYPES = new Set(['workout', 'exercise', 'warmup', 'skip', 'lastWorkoutDate'])
  var clearAt = null
  for (var i = 1; i < values.length; i++) {
    var _key = values[i][0], _type = values[i][1], _val = values[i][2]
    if (_key === 'meta' && _type === 'clearAt' && _val) {
      if (!clearAt || String(_val) > String(clearAt)) clearAt = String(_val)
    }
  }

  // Latest row per (key|type) pair wins — append-only log
  // Progress rows older than the last clearAt are ignored (weights are exempt)
  const latest = {}
  for (let i = 1; i < values.length; i++) {
    const [key, type, value, updatedAt] = values[i]
    if (!key || !type) continue
    if (clearAt && PROGRESS_TYPES.has(String(type)) && String(updatedAt) < clearAt) continue
    const mapKey = key + '|' + type
    const existing = latest[mapKey]
    if (!existing || String(updatedAt) > String(existing.updatedAt)) {
      latest[mapKey] = { key: String(key), type: String(type), value: String(value || ''), updatedAt: String(updatedAt || '') }
    }
  }

  const completions = {}
  const exerciseCompletions = {}
  const warmupCompletions = {}
  const skipCompletions = {}
  const weights = {}
  let lastWorkoutDate = null

  Object.values(latest).forEach(function(entry) {
    if (!entry.value) return // empty = untoggled/deleted

    if (entry.type === 'workout') {
      completions[entry.key] = { completedAt: entry.value }
    } else if (entry.type === 'exercise') {
      exerciseCompletions[entry.key] = { completedAt: entry.value }
    } else if (entry.type === 'warmup') {
      warmupCompletions[entry.key] = { completedAt: entry.value }
    } else if (entry.type === 'skip') {
      skipCompletions[entry.key] = { skippedAt: entry.value }
    } else if (entry.type === 'lastWorkoutDate' && entry.key === 'meta') {
      lastWorkoutDate = entry.value
    } else if (entry.type === 'weight_last') {
      var w = Number(entry.value)
      if (isFinite(w)) {
        weights[entry.key] = weights[entry.key] || {}
        weights[entry.key].last = { weight: w, updatedAt: entry.updatedAt }
      }
    } else if (entry.type === 'weight_current') {
      var w = Number(entry.value)
      if (isFinite(w)) {
        weights[entry.key] = weights[entry.key] || {}
        weights[entry.key].current = { weight: w, updatedAt: entry.updatedAt }
      }
    } else if (entry.type === 'weight_feedback') {
      weights[entry.key] = weights[entry.key] || {}
      weights[entry.key].feedback = { hint: entry.value, updatedAt: entry.updatedAt }
    }
  })

  return json({ completions, exerciseCompletions, warmupCompletions, skipCompletions, lastWorkoutDate, weights })
}

// ── Append one row ────────────────────────────────────────────────────────────

function handleWrite(params) {
  const key = params.key
  const type = params.type
  const value = params.value || ''
  const updatedAt = params.updatedAt || new Date().toISOString()

  if (!key || !type) return json({ ok: false, error: 'Missing key or type' })

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME)
  sheet.appendRow([key, type, value, updatedAt])
  return json({ ok: true })
}

// ── Helper ────────────────────────────────────────────────────────────────────

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
}
