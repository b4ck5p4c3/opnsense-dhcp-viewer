import express from 'express'
import path from 'node:path'
import z from 'zod'

import { getEnvironment } from './environment'
import { getLogger } from './logger'

const logger = getLogger()

const environment = getEnvironment()

const app = express()

app.use(express.static(path.join(process.cwd(), 'public')))

const opnSenseDhcpResponseType = z.object({
  rows: z.array(z.object({
    address: z.string(),
    descr: z.string(),
    hostname: z.string(),
    if_descr: z.string(),
    mac: z.string(),
    starts: z.string(),
    status: z.union([z.literal('offline'), z.literal('online')]),
    type: z.union([z.literal('static'), z.literal('dynamic')])
  })),
  total: z.number()
})

interface ParsedDHCPEntry {
  description: string,
  hostname: string,
  ip: string,
  isOnline: boolean,
  isStatic: boolean,
  mac: string,
  network: string,
  startedAt: null | string
}

// 2026/05/06 16:57:41
function parseOpnSenseDate (raw: string): Date | null {
  if (raw.trim().length === 0) {
    return null
  }
  const [date, time] = raw.split(' ')
  if (!date || !time) {
    throw new Error(`invalid opnsense date: ${raw}`)
  }
  const [year, month, day] = date.split('/').map(Number) as [number, number, number]
  const [hour, minute, second] = time.split(':').map(Number) as [number, number, number]
  return new Date(year, month - 1, day, hour, minute, second)
}

function parseOpnSenseDhcpResponse (result: z.infer<typeof opnSenseDhcpResponseType>): ParsedDHCPEntry[] {
  return result.rows.map(row => ({
    description: row.descr,
    hostname: row.hostname,
    ip: row.address,
    isOnline: row.status === 'online',
    isStatic: row.type === 'static',
    mac: row.mac,
    network: row.if_descr,
    startedAt: parseOpnSenseDate(row.starts)?.toISOString() ?? null
  }))
}

app.get('/api/leases', async (_, response) => {
  try {
    const opnSenseResponse = await fetch(`${environment.OPNSENSE_URL}/api/dhcpv4/leases/searchLease`, {
      headers: {
        authorization: `Basic ${btoa(`${environment.OPNSENSE_AUTH_KEY}:${environment.OPNSENSE_AUTH_SECRET}`)}`
      }
    })
    if (opnSenseResponse.status !== 200) {
      throw new Error(`invalid status: ${opnSenseResponse.status}: ${await opnSenseResponse.text()}`)
    }
    const data = parseOpnSenseDhcpResponse(opnSenseDhcpResponseType.parse(await opnSenseResponse.json()))
    response.status(200).json(data)
  } catch (error) {
    response.status(500).json({
      error: String(error)
    })
  }
})

app.listen(environment.PORT, error => {
  if (error) {
    logger.fatal(`failed to start server on :${environment.PORT}: ${error}`)
  } else {
    logger.info(`started server on :${environment.PORT}`)
  }
})
