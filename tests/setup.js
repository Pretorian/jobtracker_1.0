import fs from 'fs'
import os from 'os'
import path from 'path'
import Database from 'better-sqlite3'
import { vi, afterAll, beforeEach } from 'vitest'

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'job-tracker-test-'))
const dbPath = path.join(tmpDir, 'test.db')

process.env.JOBS_DB_PATH = dbPath
process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key-1234567890'
process.env.NODE_ENV = 'test'
process.env.SESSION_SECRET = 'test-secret'

function buildSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company TEXT NOT NULL,
      title TEXT NOT NULL,
      location TEXT,
      type TEXT,
      salary TEXT,
      summary TEXT,
      fitScore INTEGER DEFAULT 0,
      fitReason TEXT,
      url TEXT,
      status TEXT DEFAULT 'saved',
      savedDate TEXT,
      appliedDate TEXT,
      lastContact TEXT,
      notes TEXT,
      userId INTEGER,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS job_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jobId INTEGER NOT NULL,
      skill TEXT NOT NULL,
      FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jobId INTEGER NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS resume_generations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jobId INTEGER NOT NULL,
      filePath TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      type TEXT DEFAULT 'standard',
      fileSize INTEGER,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cover_letter_generations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jobId INTEGER NOT NULL,
      filePath TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      fileSize INTEGER,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS gap_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jobId INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      completedDate TEXT,
      notes TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS gap_action_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jobId INTEGER NOT NULL,
      gapItemId INTEGER,
      prompt TEXT NOT NULL,
      response TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (gapItemId) REFERENCES gap_items(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      autoApplyMode TEXT DEFAULT 'test',
      autoApplyRecordVideo INTEGER DEFAULT 1,
      autoApplyHeadless INTEGER DEFAULT 0,
      autoApplyAutoSubmit INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS application_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jobId INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      startedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      completedAt TEXT,
      agentSessionId TEXT,
      currentStep TEXT,
      progress INTEGER DEFAULT 0,
      totalSteps INTEGER DEFAULT 4,
      success INTEGER DEFAULT 0,
      submitted INTEGER DEFAULT 0,
      error TEXT,
      resumePath TEXT,
      coverLetterPath TEXT,
      videoPath TEXT,
      videoDuration INTEGER,
      videoSize INTEGER,
      formAnalysis TEXT,
      fieldsFilled INTEGER DEFAULT 0,
      totalFields INTEGER DEFAULT 0,
      fieldsAnalysis TEXT,
      metadata TEXT,
      logs TEXT,
      FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS application_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attemptId INTEGER NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      level TEXT DEFAULT 'info',
      step TEXT,
      message TEXT,
      data TEXT,
      FOREIGN KEY (attemptId) REFERENCES application_attempts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agent_sessions (
      id TEXT PRIMARY KEY,
      jobId INTEGER NOT NULL,
      status TEXT DEFAULT 'running',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      currentAction TEXT,
      context TEXT,
      decisions TEXT,
      tokensUsed INTEGER DEFAULT 0,
      apiCalls INTEGER DEFAULT 0,
      duration INTEGER DEFAULT 0,
      FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
    );
  `)
}

const seed = new Database(dbPath)
seed.pragma('journal_mode = WAL')
seed.pragma('busy_timeout = 5000')
buildSchema(seed)
seed.close()

// Tests can mutate __anthropicResponses (FIFO queue of one-shot responses)
// to control the next Anthropic.messages.create() return value.
// Each entry may be a response object or an Error to throw.
// When empty, the default response below is returned.
globalThis.__anthropicResponses = []

const defaultAnthropicBody = JSON.stringify({
  company: 'TestCorp',
  title: 'Engineer',
  location: 'Remote',
  type: 'Full-time',
  salary: null,
  keySkills: ['JS', 'Node'],
  summary: 'Test summary',
  fitScore: 80,
  fitReason: 'Good match',
  needsMoreInfo: false,
  currentScore: 50,
  targetScore: 100,
  missingSkills: ['k8s'],
  experienceGaps: [],
  certifications: [],
  recommendations: [],
  emphasisAreas: ['cloud'],
  matchingQualifications: [],
  timeline: '3 months',
  priority: 'medium',
  overallAssessment: 'Strong candidate',
  opening: 'Dear team',
  body: 'I am excited',
  closing: 'Thanks',
  objective: 'Obj',
  skills: 'JS, Node',
  keyAchievements: 'Achievements',
  relevantExperience: 'Experience',
  profileSummary: 'Summary',
  idealRoles: [],
  careerPaths: [],
  skillsToHighlight: [],
  marketDemand: 'High',
  overview: 'Plan',
  steps: [],
  milestones: [],
  estimatedTimeline: '2 weeks',
  successMetrics: [],
  job1Strengths: [],
  job2Strengths: [],
  job1Weaknesses: [],
  job2Weaknesses: [],
  skillsComparison: { uniqueToJob1: [], uniqueToJob2: [], shared: [] },
  careerImpact: { job1: '', job2: '' },
  resumeStrategy: { job1: '', job2: '' },
  recommendation: 'Job 1',
  platform: 'generic',
  strategy: 'simple',
  steps_required: [],
  confidence: 0.8,
})
globalThis.__defaultAnthropicResponse = () => ({
  content: [{ type: 'text', text: defaultAnthropicBody }],
  usage: { input_tokens: 100, output_tokens: 200 },
})

// Poison Node's require cache BEFORE any source code can `require()` these
// modules. Vite's vi.mock does not intercept `require()` calls inside CJS
// source files in this project, so we install fake module entries directly.
import { createRequire } from 'module'
const requireRoot = createRequire(path.join(process.cwd(), 'package.json'))

function installFakeModule(specifier, exports) {
  const resolved = requireRoot.resolve(specifier)
  requireRoot.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports,
    children: [],
    paths: [],
  }
}

const anthropicCreate = async () => {
  const queue = globalThis.__anthropicResponses || []
  if (queue.length > 0) {
    const next = queue.shift()
    if (next instanceof Error) throw next
    if (typeof next === 'string') {
      return { content: [{ type: 'text', text: next }], usage: { input_tokens: 1, output_tokens: 1 } }
    }
    return next
  }
  return globalThis.__defaultAnthropicResponse()
}

class FakeAnthropic {
  constructor() {
    this.messages = { create: anthropicCreate }
  }
}
function FakeAnthropicFactory(...args) {
  return new FakeAnthropic(...args)
}
FakeAnthropicFactory.default = FakeAnthropic
FakeAnthropicFactory.Anthropic = FakeAnthropic
installFakeModule('@anthropic-ai/sdk', FakeAnthropicFactory)

// Tests can mutate __playwrightFormResponse to control what
// page.evaluate() returns for form analyzer / scraper calls.
globalThis.__playwrightFormResponse = null
globalThis.__playwrightInnerText = 'Sample job description text for testing'
globalThis.__playwrightLocatorOverrides = null
globalThis.__playwrightGotoBehavior = null // function(url) {} or null for default
globalThis.__playwrightLaunchBehavior = null

function buildLocator() {
  const overrides = globalThis.__playwrightLocatorOverrides || {}
  const loc = {
    first: () => loc,
    nth: () => loc,
    count: async () => overrides.count ?? 1,
    isVisible: async () => overrides.isVisible ?? true,
    click: async () => overrides.click?.() ?? undefined,
    fill: async () => undefined,
    check: async () => undefined,
    selectOption: async () => undefined,
    setInputFiles: async () => undefined,
    evaluate: async (fn) => {
      if (overrides.evaluate) return overrides.evaluate(fn)
      // Return safe defaults for evaluate calls
      try {
        if (typeof fn === 'function') {
          return fn({ tagName: 'INPUT', type: 'text' })
        }
      } catch {}
      return 'input'
    },
  }
  return loc
}

function buildPage() {
  return {
    goto: async (url) => {
      if (globalThis.__playwrightGotoBehavior) {
        return globalThis.__playwrightGotoBehavior(url)
      }
    },
    waitForTimeout: async () => undefined,
    waitForLoadState: async () => undefined,
    waitForSelector: async () => undefined,
    evaluate: async (fn, ...args) => {
      if (globalThis.__playwrightFormResponse !== null) {
        return globalThis.__playwrightFormResponse
      }
      // default for form analyzer
      return {
        fields: [
          { type: 'text', name: 'firstName', label: 'first name', selector: '[name="firstName"]', required: true, value: '', options: [] },
          { type: 'email', name: 'email', label: 'email', selector: '[name="email"]', required: true, value: '', options: [] },
        ],
        uploads: [
          { type: 'file', name: 'resume', label: 'resume', selector: '[name="resume"]', accept: '.pdf,.docx', required: true },
        ],
        submitButton: 'Submit',
      }
    },
    $: async () => ({
      innerText: async () => globalThis.__playwrightInnerText,
    }),
    locator: () => buildLocator(),
    close: async () => undefined,
    setViewportSize: async () => undefined,
    on: () => undefined,
  }
}

const fakePlaywright = {
  chromium: {
    launch: async () => {
      if (globalThis.__playwrightLaunchBehavior) {
        return globalThis.__playwrightLaunchBehavior()
      }
      const page = buildPage()
      return {
        newPage: async () => page,
        newContext: async () => ({
          newPage: async () => page,
        }),
        close: async () => undefined,
      }
    },
  },
  firefox: { launch: async () => ({ close: async () => {}, newPage: async () => buildPage() }) },
  webkit: { launch: async () => ({ close: async () => {}, newPage: async () => buildPage() }) },
}
installFakeModule('playwright', fakePlaywright)

// Puppeteer (used by intelligent-agent.js). Mirror the playwright fake shape.
globalThis.__puppeteerFieldsResponse = null
const fakePuppeteer = {
  launch: async () => {
    return {
      newPage: async () => ({
        goto: async () => undefined,
        setViewport: async () => undefined,
        waitForTimeout: async () => undefined,
        evaluate: async () => globalThis.__puppeteerFieldsResponse ?? [
          {
            index: 1,
            type: 'input',
            inputType: 'text',
            name: 'firstName',
            id: 'firstName',
            placeholder: '',
            label: 'First name',
            required: true,
            value: '',
            selector: '#firstName',
          },
          {
            index: 2,
            type: 'input',
            inputType: 'file',
            name: 'resume',
            id: 'resume',
            placeholder: '',
            label: 'Resume',
            required: true,
            value: '',
            selector: '#resume',
          },
        ],
        close: async () => undefined,
        on: () => undefined,
      }),
      close: async () => undefined,
    }
  },
}
fakePuppeteer.default = fakePuppeteer
installFakeModule('puppeteer', fakePuppeteer)

class FakePuppeteerScreenRecorder {
  constructor() {}
  async start() {}
  async stop() {}
}
installFakeModule('puppeteer-screen-recorder', { PuppeteerScreenRecorder: FakePuppeteerScreenRecorder })

globalThis.__mammothExtractRawTextBehavior = null
const fakeMammoth = {
  extractRawText: async (input) => {
    if (globalThis.__mammothExtractRawTextBehavior) {
      return globalThis.__mammothExtractRawTextBehavior(input)
    }
    return { value: 'Mock resume text content from mammoth', messages: [] }
  },
  convertToHtml: async () => ({ value: '<p>Mock html</p>', messages: [] }),
}
fakeMammoth.default = fakeMammoth
installFakeModule('mammoth', fakeMammoth)

class FakePizZip {
  constructor() {}
  generate() {
    return Buffer.from('fake-docx-binary')
  }
}
installFakeModule('pizzip', FakePizZip)

class FakeDocxtemplater {
  constructor() {}
  render() {}
  getZip() {
    return {
      generate: () => Buffer.from('fake-docx-binary'),
    }
  }
}
installFakeModule('docxtemplater', FakeDocxtemplater)

// Replace express-rate-limit with a no-op pass-through for tests so we
// don't exhaust the AI/bulk limiters across many test cases.
function fakeRateLimit() {
  return (req, res, next) => next()
}
fakeRateLimit.default = fakeRateLimit
installFakeModule('express-rate-limit', fakeRateLimit)

global.__TEST_DB_PATH__ = dbPath
global.__TEST_TMP_DIR__ = tmpDir
global.__resetDb = () => {
  // Reuse the module-level `db` connection from database.js so writes are
  // visible immediately to other queries via the same connection.
  // eslint-disable-next-line global-require
  const { db } = require('../server/db/database')
  db.exec(`
    DELETE FROM application_logs;
    DELETE FROM application_attempts;
    DELETE FROM agent_sessions;
    DELETE FROM gap_action_plans;
    DELETE FROM gap_items;
    DELETE FROM cover_letter_generations;
    DELETE FROM resume_generations;
    DELETE FROM activity_log;
    DELETE FROM job_skills;
    DELETE FROM jobs;
    DELETE FROM users;
    DELETE FROM app_settings;
  `)
  try { db.exec('DELETE FROM sqlite_sequence;') } catch {}
}

beforeEach(() => {
  global.__resetDb()
  // Reset mock state for hermetic tests
  globalThis.__anthropicResponses = []
  globalThis.__playwrightFormResponse = null
  globalThis.__playwrightLocatorOverrides = null
  globalThis.__playwrightGotoBehavior = null
  globalThis.__playwrightLaunchBehavior = null
  globalThis.__playwrightInnerText = 'Sample job description text for testing'
  globalThis.__puppeteerFieldsResponse = null
  globalThis.__mammothExtractRawTextBehavior = null
})

afterAll(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  } catch {}
})
