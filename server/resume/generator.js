const fs = require('fs')
const path = require('path')
const PizZip = require('pizzip')
const Docxtemplater = require('docxtemplater')
const { logResumeGeneration } = require('../db/database')

/**
 * Generate a tailored resume for a specific job
 * @param {Object} job - The job object from the database
 * @returns {Promise<Object>} - Object with url and filePath
 */
async function generateResumeForJob(job) {
  console.log(`\n📝 Generating resume for: ${job.title} at ${job.company}`)

  try {
    // Path to master resume template
    const templatePath = path.join(__dirname, '../../data/master-resume-template.docx')

    // Check if template exists
    if (!fs.existsSync(templatePath)) {
      console.error('  ❌ Master resume template not found!')
      console.error(`  💡 Expected location: ${templatePath}`)
      throw new Error(
        'Master resume template not found. Please add your resume template at: data/master-resume-template.docx'
      )
    }

    console.log('  ✅ Template found, reading file...')

    // Read the template file
    const content = fs.readFileSync(templatePath, 'binary')
    const zip = new PizZip(content)
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    })

    // Static master content fills the narrative sections ({objective}, {summary},
    // {keyAchievements}, {relevantExperience}) for the non-AI "standard" resume so
    // the template's sections aren't left empty. The optimized generator overrides
    // these with AI-tailored content.
    let masterContent = {}
    try {
      masterContent = require('../../data/master-content.json')
    } catch (e) {
      console.warn('  ⚠️  data/master-content.json not found; narrative sections will be blank')
    }

    // Prepare data for template
    const resumeData = {
      ...masterContent,
      targetCompany: job.company,
      targetRole: job.title,
      targetLocation: job.location || 'Remote',
      // Prefer the job's key skills; fall back to the master skill set.
      skills: (job.keySkills || []).length ? job.keySkills.join(', ') : masterContent.skills || '',
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    }

    console.log('  📋 Template data:')
    console.log(`     Company: ${resumeData.targetCompany}`)
    console.log(`     Role: ${resumeData.targetRole}`)
    console.log(`     Location: ${resumeData.targetLocation}`)
    console.log(`     Skills: ${resumeData.skills}`)

    // Render the document
    console.log('  🔄 Rendering document with template data...')
    doc.render(resumeData)

    // Generate the output
    const buf = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    })

    // Create output filename
    const timestamp = Date.now()
    const safeCompany = job.company.replace(/[^a-z0-9]/gi, '_')
    const safeRole = job.title.replace(/[^a-z0-9]/gi, '_')
    const filename = `resume_${safeCompany}_${safeRole}_${timestamp}.docx`

    // Ensure output directory exists
    const outputDir = path.join(__dirname, '../../public/resumes')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Save the file
    const outputPath = path.join(outputDir, filename)
    fs.writeFileSync(outputPath, buf)
    console.log(`  ✅ Resume saved: ${filename}`)

    // Log in database
    const relativePath = `/resumes/${filename}`
    logResumeGeneration(job.id, outputPath, 'standard')
    console.log(`  📊 Database updated\n`)

    const port = process.env.PORT || 3000;
    return {
      success: true,
      url: `http://localhost:${port}${relativePath}`,
      filePath: relativePath,
      filename,
    }
  } catch (error) {
    console.error('  ❌ Resume generation error:', error.message)
    throw new Error(`Failed to generate resume: ${error.message}`)
  }
}

/**
 * Create a sample master resume template if one doesn't exist
 */
function createSampleTemplate() {
  const templatePath = path.join(__dirname, '../../data/master-resume-template.docx')

  if (fs.existsSync(templatePath)) {
    console.log('✓ Master resume template already exists')
    return
  }

  console.log('\n⚠️  No master resume template found!')
  console.log('Please create a Word document (.docx) with your resume and save it as:')
  console.log(`   ${templatePath}`)
  console.log('\nYou can use template variables in your resume:')
  console.log('   {targetCompany} - Will be replaced with the company name')
  console.log('   {targetRole} - Will be replaced with the job title')
  console.log('   {targetLocation} - Will be replaced with the location')
  console.log('   {skills} - Will be replaced with the key skills for the job')
  console.log('   {date} - Will be replaced with the current date')
  console.log('\nExample usage in your resume:')
  console.log('   "I am excited to apply for the {targetRole} position at {targetCompany}"')
}

module.exports = {
  generateResumeForJob,
  createSampleTemplate,
}
