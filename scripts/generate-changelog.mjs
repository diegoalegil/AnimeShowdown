#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

const SECTION_BY_TYPE = new Map([
  ['feat', 'Added'],
  ['fix', 'Fixed'],
  ['perf', 'Changed'],
  ['refactor', 'Changed'],
  ['style', 'Changed'],
  ['build', 'Changed'],
  ['ci', 'Changed'],
  ['chore', 'Maintenance'],
  ['docs', 'Documentation'],
  ['test', 'Tests'],
  ['revert', 'Reverted'],
])

function runGit(args, { allowFailure = false } = {}) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch (error) {
    if (allowFailure) return ''
    const details = error.stderr?.toString().trim()
    throw new Error(details || `git ${args.join(' ')} failed`)
  }
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    from: '',
    to: 'HEAD',
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dry-run') {
      args.dryRun = true
    } else if (arg === '--from') {
      args.from = argv[i + 1] || ''
      i += 1
    } else if (arg === '--to') {
      args.to = argv[i + 1] || 'HEAD'
      i += 1
    } else if (arg === '--help' || arg === '-h') {
      args.help = true
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  return args
}

function latestTag() {
  return runGit(['describe', '--tags', '--abbrev=0'], { allowFailure: true })
}

function commitRange(from, to) {
  if (from) return `${from}..${to}`
  const tag = latestTag()
  return tag ? `${tag}..${to}` : to
}

function parseCommit(line) {
  const [hash, subject] = line.split('\x1f')
  const match = subject.match(/^(\w+)(?:\(([^)]+)\))?(!)?:\s+(.+)$/)
  if (!match) {
    return {
      hash,
      section: 'Changed',
      text: subject,
      breaking: false,
    }
  }

  const [, type, scope, bang, description] = match
  const section = SECTION_BY_TYPE.get(type) ?? 'Changed'
  return {
    hash,
    section: bang ? 'Breaking Changes' : section,
    text: scope ? `**${scope}:** ${description}` : description,
    breaking: Boolean(bang),
  }
}

function groupedCommits(range) {
  const raw = runGit(['log', range, '--pretty=format:%h%x1f%s'], {
    allowFailure: true,
  })
  if (!raw) return new Map()

  return raw
    .split('\n')
    .map(parseCommit)
    .reduce((groups, commit) => {
      if (!groups.has(commit.section)) groups.set(commit.section, [])
      groups.get(commit.section).push(commit)
      return groups
    }, new Map())
}

function render(groups, range) {
  const order = [
    'Breaking Changes',
    'Added',
    'Changed',
    'Fixed',
    'Documentation',
    'Tests',
    'Maintenance',
    'Reverted',
  ]
  const lines = [
    '## [Unreleased]',
    '',
    `Range: \`${range}\``,
    '',
  ]

  let wroteSection = false
  for (const section of order) {
    const commits = groups.get(section)
    if (!commits?.length) continue
    wroteSection = true
    lines.push(`### ${section}`, '')
    commits.forEach((commit) => {
      lines.push(`- ${commit.text} (${commit.hash})`)
    })
    lines.push('')
  }

  if (!wroteSection) {
    lines.push('No commits found for this range.', '')
  }

  return lines.join('\n')
}

function usage() {
  return [
    'Usage:',
    '  node scripts/generate-changelog.mjs --dry-run [--from <tag-or-sha>] [--to <tag-or-sha>]',
    '',
    'Examples:',
    '  node scripts/generate-changelog.mjs --dry-run',
    '  node scripts/generate-changelog.mjs --dry-run --from v1.0.0 --to HEAD',
  ].join('\n')
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(usage())
    return
  }
  if (!args.dryRun) {
    throw new Error('Only --dry-run is supported for now. Review output before editing CHANGELOG.md.')
  }

  const range = commitRange(args.from, args.to)
  console.log(render(groupedCommits(range), range))
}

try {
  main()
} catch (error) {
  console.error(error.message)
  console.error('')
  console.error(usage())
  process.exit(1)
}
