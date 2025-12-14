import { sheetMock } from '../data/sheetMock'
import { transformPlan } from '../utils/transformPlan'

export default defineEventHandler(() => {
  // In production, replace sheetMock with a Google Sheets fetcher.
  const payload = transformPlan(sheetMock)
  return {
    updatedAt: new Date().toISOString(),
    ...payload
  }
})
