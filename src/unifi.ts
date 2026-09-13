import z from 'zod'

import { getLogger } from './logger'

const logger = getLogger()

export interface UnifiAPIConfig {
  siteId: string
  token: string
  url: string
}

function paginatedResponseType<T extends z.ZodTypeAny> (dataType: T) {
  return z.object({
    data: z.array(dataType),
    totalCount: z.number()
  })
}

const clientOverviewType = z.object({
  macAddress: z.string().optional(),
  name: z.string(),
  type: z.enum(['WIRED', 'WIRELESS', 'VPN', 'TELEPORT']),
  uplinkDeviceId: z.string().optional()
})

const adoptedDeviceOverviewType = z.object({
  id: z.string(),
  name: z.string()
})

// broadcastingDeviceFilter is null when a WiFi broadcast is beamed from every AP on the site
const wifiBroadcastOverviewType = z.object({
  broadcastingDeviceFilter: z.object({
    deviceIds: z.array(z.string()).optional(),
    type: z.string()
  }).nullable().optional(),
  name: z.string()
})

export interface UnifiClientInfo {
  ap: null | string
  essid: null | string
  mac: string
}

export type UnifiClientInfos = UnifiClientInfo[]

export class UnifiAPI {
  constructor (private readonly config: UnifiAPIConfig) {}

  async getActiveClients (): Promise<UnifiClientInfos> {
    const [clients, devices, broadcasts] = await Promise.all([
      this.fetchAllPages(`/v1/sites/${this.config.siteId}/clients`, clientOverviewType),
      this.fetchAllPages(`/v1/sites/${this.config.siteId}/devices`, adoptedDeviceOverviewType),
      this.fetchAllPages(`/v1/sites/${this.config.siteId}/wifi/broadcasts`, wifiBroadcastOverviewType)
    ])

    const deviceNameById = new Map(devices.map(device => [device.id, device.name]))

    return clients
      .filter((client): client is z.infer<typeof clientOverviewType> & { macAddress: string } =>
        client.type === 'WIRELESS' && client.macAddress !== undefined)
      .map(client => {
        const apDeviceId = client.uplinkDeviceId
        const apName = apDeviceId === undefined ? undefined : deviceNameById.get(apDeviceId)
        const essid = broadcasts.find(broadcast => {
          const deviceFilter = broadcast.broadcastingDeviceFilter
          const appliesToApDevice = apDeviceId !== undefined && deviceFilter?.deviceIds?.includes(apDeviceId) === true
          return deviceFilter == null || appliesToApDevice
        })?.name

        return {
          ap: apName ?? null,
          essid: essid ?? null,
          mac: client.macAddress
        }
      })
  }

  private async fetchAllPages<T> (path: string, dataType: z.ZodType<T>): Promise<T[]> {
    const pageType = paginatedResponseType(dataType)
    const results: T[] = []
    const limit = 200 // Max per UniFi API
    let offset = 0
    for (;;) {
      const url = new URL(`${this.config.url}/proxy/network/integration${path}`)
      url.searchParams.set('offset', String(offset))
      url.searchParams.set('limit', String(limit))
      const response = await fetch(url, {
        headers: {
          'X-API-Key': this.config.token
        }
      })
      if (response.status !== 200) {
        const body = await response.text()
        logger.error(`unifi request failed: GET ${url.toString()} -> ${response.status}: ${body}`)
        throw new Error(`failed to fetch ${path}: ${response.status}: ${body}`)
      }
      const page = pageType.parse(await response.json())
      results.push(...page.data)
      offset += page.data.length
      if (page.data.length === 0 || offset >= page.totalCount) {
        break
      }
    }
    return results
  }
}
