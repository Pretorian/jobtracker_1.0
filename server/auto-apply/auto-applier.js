const { generateResumeForJob } = require('../resume/generator')
const { generateCoverLetter } = require('../cover-letter/generator')
const { analyzeApplicationForm, mapFieldsToData } = require('./form-analyzer')
const { fillApplicationForm } = require('./form-filler')
const path = require('path')
const fs = require('fs')

/**
 * Auto-apply to a job: generate documents, analyze form, fill application
 */
async function autoApplyToJob(job, userData, options = {}) {
  const {
    autoSubmit = false, // Whether to auto-submit (dangerous!) vs review
    dryRun = false, // Just generate docs and analyze, don't fill
    headless = false, // Run browser in background (headless mode)
    fieldMappingOverride = null // User-verified field values to use instead of auto-mapped ones
  } = options

  console.log(`\n🤖 AUTO-APPLY STARTING`)
  console.log(`══════════════════════════════════════════════════════════════`)
  console.log(`  Job: ${job.title} at ${job.company}`)
  console.log(`  URL: ${job.url}`)
  console.log(`  Mode: ${dryRun ? 'DRY RUN (preview only)' : autoSubmit ? 'AUTO-SUBMIT' : 'REVIEW MODE'}`)
  console.log(`══════════════════════════════════════════════════════════════\n`)

  const results = {
    success: false,
    steps: {
      resumeGenerated: false,
      coverLetterGenerated: false,
      formAnalyzed: false,
      formFilled: false
    },
    files: {},
    formData: null,
    error: null
  }

  try {
    // Step 1: Generate tailored resume
    console.log(`📄 Step 1/4: Generating tailored resume...`)
    const resumeResult = await generateResumeForJob(job)
    results.files.resume = resumeResult.filePath
    results.steps.resumeGenerated = true
    console.log(`  ✅ Resume generated: ${path.basename(resumeResult.filePath)}`)

    // Step 2: Generate cover letter
    console.log(`\n📝 Step 2/4: Generating cover letter...`)
    const coverLetterResult = await generateCoverLetter(job)
    results.files.coverLetter = coverLetterResult.filePath
    results.steps.coverLetterGenerated = true
    console.log(`  ✅ Cover letter generated: ${path.basename(coverLetterResult.filePath)}`)

    // Step 3: Analyze application form
    if (!job.url) {
      throw new Error('Job URL is required for auto-apply')
    }

    console.log(`\n🔍 Step 3/4: Analyzing application form...`)
    const formData = await analyzeApplicationForm(job.url)
    results.formData = formData
    results.steps.formAnalyzed = true
    console.log(`  ✅ Form analyzed: ${formData.fields.length} fields, ${formData.uploads.length} uploads`)

    // Map form fields to user data, then apply any values the user verified/edited
    // in the review step (overrides win; cleared values are kept so they aren't filled)
    let fieldMapping = mapFieldsToData(formData.fields, userData)
    if (fieldMappingOverride && typeof fieldMappingOverride === 'object') {
      fieldMapping = { ...fieldMapping, ...fieldMappingOverride }
      console.log(`  ✏️  Applied ${Object.keys(fieldMappingOverride).length} user-verified field value(s)`)
    }
    results.fieldMapping = fieldMapping

    // If dry run, stop here
    if (dryRun) {
      console.log(`\n⏸️  DRY RUN MODE: Stopping before form fill`)
      console.log(`\n📋 Preview:`)
      console.log(`  Resume: ${results.files.resume}`)
      console.log(`  Cover Letter: ${results.files.coverLetter}`)
      console.log(`  Fields to fill: ${Object.keys(fieldMapping).length}`)
      results.success = true
      return results
    }

    // Step 4: Fill application form
    console.log(`\n✍️  Step 4/4: Filling application form...`)
    const fillResult = await fillApplicationForm(
      job.url,
      fieldMapping,
      {
        resume: results.files.resume,
        coverLetter: results.files.coverLetter
      },
      {
        headless: options.headless || false,
        autoSubmit: autoSubmit,
        slowMo: options.headless ? 0 : 100
      }
    )

    results.steps.formFilled = true
    results.submitted = fillResult.submitted || false
    results.browser = fillResult.browser
    results.success = true

    console.log(`\n══════════════════════════════════════════════════════════════`)
    console.log(`✅ AUTO-APPLY COMPLETE`)
    console.log(`══════════════════════════════════════════════════════════════`)
    console.log(`  ✓ Resume: ${path.basename(results.files.resume)}`)
    console.log(`  ✓ Cover Letter: ${path.basename(results.files.coverLetter)}`)
    console.log(`  ✓ Form fields filled: ${Object.keys(fieldMapping).length}`)
    console.log(`  💡 Browser window open for your review`)
    console.log(`══════════════════════════════════════════════════════════════\n`)

    return results

  } catch (error) {
    console.error(`\n❌ AUTO-APPLY FAILED:`, error.message)
    results.error = error.message
    results.success = false
    return results
  }
}

/**
 * Get default user data from environment or config
 */
function getDefaultUserData() {
  return {
    firstName: process.env.USER_FIRST_NAME || '',
    lastName: process.env.USER_LAST_NAME || '',
    fullName: process.env.USER_FULL_NAME || '',
    email: process.env.USER_EMAIL || '',
    phone: process.env.USER_PHONE || '',
    linkedin: process.env.USER_LINKEDIN || '',
    portfolio: process.env.USER_PORTFOLIO || '',
    city: process.env.USER_CITY || '',
    state: process.env.USER_STATE || '',
    country: process.env.USER_COUNTRY || 'United States',
    zipCode: process.env.USER_ZIP || '',
    address: process.env.USER_ADDRESS || '',
    workAuthorization: process.env.USER_WORK_AUTH || 'Yes',
    requiresSponsorship: process.env.USER_REQUIRES_SPONSOR || 'No',
    yearsOfExperience: process.env.USER_YEARS_EXP || '',
    desiredSalary: process.env.USER_DESIRED_SALARY || '',
    startDate: process.env.USER_START_DATE || 'Immediate'
  }
}

module.exports = {
  autoApplyToJob,
  getDefaultUserData
}
