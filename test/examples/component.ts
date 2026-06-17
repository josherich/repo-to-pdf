type Status = 'idle' | 'running' | 'done'

export function label(status: Status): string {
  return `status:${status}`
}

