const { chromium } = require('playwright')

/**
 * Analyze an application form to understand its structure
 */
async function analyzeApplicationForm(url) {
  console.log(`\n🔍 Analyzing application form at: ${url}`)

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000) // Wait for dynamic content

    // Extract form fields
    const formData = await page.evaluate(() => {
      const fields = []

      // Find all input fields
      const inputs = document.querySelectorAll('input, textarea, select')
      inputs.forEach((input, index) => {
        const type = input.type || input.tagName.toLowerCase()
        const name = input.name || input.id || `field_${index}`
        const label = input.labels?.[0]?.textContent?.trim() ||
                     input.placeholder ||
                     input.getAttribute('aria-label') ||
                     input.previousElementSibling?.textContent?.trim() ||
                     ''

        // Skip hidden fields, submit buttons, etc.
        if (type === 'hidden' || type === 'submit' || type === 'button') {
          return
        }

        fields.push({
          type,
          name,
          label: label.toLowerCase(),
          selector: input.name ? `[name="${input.name}"]` :
                   input.id ? `#${input.id}` :
                   `${input.tagName.toLowerCase()}:nth-child(${index + 1})`,
          required: input.required || input.getAttribute('aria-required') === 'true',
          value: input.value || '',
          options: type === 'select' ?
            Array.from(input.options).map(opt => ({ value: opt.value, text: opt.textContent.trim() })) :
            []
        })
      })

      // Find file upload fields
      const fileInputs = document.querySelectorAll('input[type="file"]')
      const uploads = Array.from(fileInputs).map((input, index) => {
        const label = input.labels?.[0]?.textContent?.trim() ||
                     input.getAttribute('aria-label') ||
                     input.previousElementSibling?.textContent?.trim() ||
                     ''

        return {
          type: 'file',
          name: input.name || input.id || `file_${index}`,
          label: label.toLowerCase(),
          selector: input.name ? `[name="${input.name}"]` : `#${input.id}`,
          accept: input.accept || '',
          required: input.required
        }
      })

      return {
        fields,
        uploads,
        submitButton: document.querySelector('button[type="submit"], input[type="submit"]')?.textContent?.trim() || 'Submit'
      }
    })

    console.log(`  ✅ Found ${formData.fields.length} form fields`)
    console.log(`  ✅ Found ${formData.uploads.length} file upload fields`)

    await browser.close()
    return formData

  } catch (error) {
    await browser.close()
    throw new Error(`Failed to analyze form: ${error.message}`)
  }
}

/**
 * Map form fields to user data
 */
function mapFieldsToData(fields, userData) {
  const mapping = {}

  fields.forEach(field => {
    const label = field.label.toLowerCase()

    // Name fields
    if (label.includes('first name') || label.includes('firstname')) {
      mapping[field.name] = userData.firstName || ''
    } else if (label.includes('last name') || label.includes('lastname')) {
      mapping[field.name] = userData.lastName || ''
    } else if (label.includes('full name') || (label.includes('name') && !label.includes('company'))) {
      mapping[field.name] = userData.fullName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim()
    }

    // Email
    else if (label.includes('email') || field.type === 'email') {
      mapping[field.name] = userData.email || ''
    }

    // Phone
    else if (label.includes('phone') || label.includes('mobile') || field.type === 'tel') {
      mapping[field.name] = userData.phone || ''
    }

    // LinkedIn
    else if (label.includes('linkedin')) {
      mapping[field.name] = userData.linkedin || ''
    }

    // Portfolio/Website
    else if (label.includes('portfolio') || label.includes('website')) {
      mapping[field.name] = userData.portfolio || ''
    }

    // Location/Address
    else if (label.includes('city')) {
      mapping[field.name] = userData.city || ''
    } else if (label.includes('state') || label.includes('province')) {
      mapping[field.name] = userData.state || ''
    } else if (label.includes('country')) {
      mapping[field.name] = userData.country || ''
    } else if (label.includes('zip') || label.includes('postal')) {
      mapping[field.name] = userData.zipCode || ''
    } else if (label.includes('address')) {
      mapping[field.name] = userData.address || ''
    }

    // Work Authorization
    else if (label.includes('authorized') || label.includes('work authorization')) {
      mapping[field.name] = userData.workAuthorization || 'Yes'
    }

    // Sponsorship
    else if (label.includes('sponsor')) {
      mapping[field.name] = userData.requiresSponsorship || 'No'
    }

    // Years of Experience
    else if (label.includes('years') && label.includes('experience')) {
      mapping[field.name] = userData.yearsOfExperience || ''
    }

    // Salary
    else if (label.includes('salary') || label.includes('compensation')) {
      mapping[field.name] = userData.desiredSalary || ''
    }

    // Start Date
    else if (label.includes('start date') || label.includes('available')) {
      mapping[field.name] = userData.startDate || ''
    }
  })

  return mapping
}

module.exports = {
  analyzeApplicationForm,
  mapFieldsToData
}
