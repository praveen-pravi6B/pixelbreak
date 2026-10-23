import { describe, it, expect } from 'vitest'
import { loadConfig } from '@pixelbreak/config'

// ---------------------------------------------------------------------------
// Config loader — path traversal guard
// ---------------------------------------------------------------------------

describe('loadConfig — path traversal guard', () => {
  it('rejects a config path outside the project directory', () => {
    expect(() => loadConfig('/etc/passwd')).toThrow(/within the project directory/)
  })

  it('rejects a path traversal attempt using ..', () => {
    expect(() => loadConfig('../../outside/config.yml')).toThrow(/within the project directory/)
  })

  it('rejects an absolute path to a system file', () => {
    expect(() => loadConfig('/usr/local/bin/something')).toThrow(/within the project directory/)
  })

  it('accepts a valid config path within the project', () => {
    // The real config exists at .pixelbreak.yml in the monorepo root
    expect(() => loadConfig('.pixelbreak.yml')).not.toThrow()
  })

  it('accepts a relative path within the project', () => {
    // .pixelbreak.yml.example is also in the project root
    expect(() => loadConfig('.pixelbreak.yml.example')).not.toThrow()
  })
})
