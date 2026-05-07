import z from 'zod'

export interface UnifiAPIConfig {
  password: string
  url: string
  username: string
}

const unifiClientInfosType = z.array(z.object({
  essid: z.string(),
  last_uplink_name: z.string(),
  mac: z.string()
}))

export type UnifiClientInfos = z.infer<typeof unifiClientInfosType>

export class UnifiAPI {
  constructor (private readonly config: UnifiAPIConfig) {}

  async getActiveClients (): Promise<UnifiClientInfos> {
    const cookie = await this.login()
    const response = await fetch(`${this.config.url}/v2/api/site/default/clients/active`, {
      headers: {
        cookie
      }
    })
    if (response.status !== 200) {
      throw new Error(`failed to fetch unifi active clients: ${response.status}`)
    }
    return unifiClientInfosType.parse(await response.json())
  }

  private async login (): Promise<string> {
    const response = await fetch(`${this.config.url}/api/login`, {
      body: JSON.stringify({
        password: this.config.password,
        username: this.config.username
      }),
      headers: {
        'content-type': 'application/json'
      },
      method: 'POST'
    })
    if (response.status === 200) {
      const data = await response.json()
      if (data.meta.rc === 'ok') {
        return parseUniFiSessionCookie(response.headers.getSetCookie())
      } else {
        throw new Error(`failed to login to UniFi controller: ${JSON.stringify(response.status)} / ${JSON.stringify(data)}`)
      }
    }
    throw new Error(`failed to login to UniFi controller: ${JSON.stringify(response.status)}`)
  }
}

function parseUniFiSessionCookie (cookies: string[]): string {
  for (const cookie of cookies) {
    if (cookie.startsWith('unifises=')) {
      const part = cookie.split(';')[0]
      if (!part) {
        continue
      }
      return part
    }
  }
  throw new Error(`unifises cookie not found: ${JSON.stringify(cookies)}`)
}
