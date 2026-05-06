import { config } from 'dotenv'
import { z } from 'zod'

config({
  path: '.env.local',
  quiet: true
})
config({
  quiet: true
})

const environmentType = z.object({
  OPNSENSE_AUTH_KEY: z.string(),
  OPNSENSE_AUTH_SECRET: z.string(),
  OPNSENSE_URL: z.url(),
  PORT: z.string().default('3000').transform(Number)
})

export type Environment = z.infer<typeof environmentType>

export function getEnvironment (): Environment {
  return environmentType.parse(process.env)
}
