const { chromium } = require('playwright')
const path = require('path')

/**
 * Fill out an application form automatically
 */
async function fillApplicationForm(url, fieldMapping, files = {}, options = {}) {
  const {
    headless = false, // Run in headless mode (background)
    autoSubmit = false, // Automatically submit the form
    slowMo = 100 // Delay between actions
  } = options

  console.log(`\n📝 Filling out application form at: ${url}`)
  console.log(`  Mode: ${headless ? 'Background' : 'Visible'} | Auto-submit: ${autoSubmit ? 'Yes' : 'No'}`)

  const browser = await chromium.launch({
    headless,
    slowMo: headless ? 0 : slowMo // No slowdown in headless mode
  })

  const page = await browser.newPage()

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)

    console.log(`  📋 Filling ${Object.keys(fieldMapping).length} fields...`)

    // Fill each field
    for (const [fieldName, value] of Object.entries(fieldMapping)) {
      if (!value) continue // Skip empty values

      try {
        // Try multiple selector strategies
        const selectors = [
          `[name="${fieldName}"]`,
          `#${fieldName}`,
          `[id*="${fieldName}"]`,
          `[name*="${fieldName}"]`
        ]

        let filled = false
        for (const selector of selectors) {
          try {
            const element = await page.locator(selector).first()
            if (await element.count() > 0) {
              const tagName = await element.evaluate(el => el.tagName.toLowerCase())
              const type = await element.evaluate(el => el.type || '')

              if (tagName === 'select') {
                await element.selectOption({ label: value })
              } else if (type === 'checkbox' || type === 'radio') {
                if (value === 'Yes' || value === true || value === 'true') {
                  await element.check()
                }
              } else {
                await element.fill(value)
              }

              console.log(`    ✓ Filled: ${fieldName} = ${value}`)
              filled = true
              break
            }
          } catch (e) {
            // Try next selector
          }
        }

        if (!filled) {
          console.log(`    ⚠️  Could not find field: ${fieldName}`)
        }

        await page.waitForTimeout(200) // Small delay between fields

      } catch (error) {
        console.error(`    ❌ Error filling ${fieldName}:`, error.message)
      }
    }

    // Upload files
    if (files.resume) {
      console.log(`  📎 Uploading resume...`)
      await uploadFile(page, ['resume', 'cv'], files.resume)
    }

    if (files.coverLetter) {
      console.log(`  📎 Uploading cover letter...`)
      await uploadFile(page, ['cover', 'cover letter', 'letter'], files.coverLetter)
    }

    console.log(`\n  ✅ Form filled successfully!`)

    // Auto-submit if enabled
    if (autoSubmit) {
      console.log(`  🚀 Auto-submitting form...`)
      try {
        // Try to find and click submit button
        const submitSelectors = [
          'button[type="submit"]',
          'input[type="submit"]',
          'button:has-text("Submit")',
          'button:has-text("Apply")',
          'button:has-text("Send")',
          '[role="button"]:has-text("Submit")',
          '[role="button"]:has-text("Apply")'
        ]

        let submitted = false
        for (const selector of submitSelectors) {
          try {
            const submitButton = page.locator(selector).first()
            if (await submitButton.count() > 0 && await submitButton.isVisible()) {
              await submitButton.click()
              console.log(`  ✅ Form submitted!`)
              submitted = true
              await page.waitForTimeout(2000) // Wait for submission
              break
            }
          } catch (e) {
            // Try next selector
          }
        }

        if (!submitted) {
          console.log(`  ⚠️  Could not find submit button - form filled but not submitted`)
        }

        await browser.close()
        return {
          success: true,
          submitted,
          message: submitted ? 'Form filled and submitted successfully!' : 'Form filled but could not auto-submit'
        }
      } catch (submitError) {
        console.error(`  ❌ Error submitting form:`, submitError.message)
        await browser.close()
        return {
          success: true,
          submitted: false,
          message: 'Form filled but submission failed: ' + submitError.message
        }
      }
    } else {
      // Keep browser open for user review
      console.log(`  ⏸️  Browser ${headless ? 'running in background' : 'paused'} for user review...`)
      console.log(`  💡 Review the form and submit manually${headless ? '' : ', or close the browser to cancel'}`)

      if (headless) {
        // In headless mode, we can't keep browser open, so close it
        await browser.close()
      }

      return {
        success: true,
        submitted: false,
        message: 'Form filled successfully. Please review and submit manually.',
        browser: headless ? null : browser // Return browser handle only if visible
      }
    }

  } catch (error) {
    await browser.close()
    throw new Error(`Failed to fill form: ${error.message}`)
  }
}

/**
 * Upload a file to a file input field
 */
async function uploadFile(page, labelKeywords, filePath) {
  // Try to find file input by label keywords
  for (const keyword of labelKeywords) {
    try {
      const selectors = [
        `input[type="file"][name*="${keyword}"]`,
        `input[type="file"][id*="${keyword}"]`,
        `input[type="file"][aria-label*="${keyword}"]`
      ]

      for (const selector of selectors) {
        const fileInput = page.locator(selector).first()
        if (await fileInput.count() > 0) {
          await fileInput.setInputFiles(filePath)
          console.log(`    ✓ Uploaded file: ${path.basename(filePath)}`)
          return
        }
      }
    } catch (e) {
      // Try next keyword
    }
  }

  // Fallback: try any file input
  try {
    const fileInput = page.locator('input[type="file"]').first()
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(filePath)
      console.log(`    ✓ Uploaded file to first available input: ${path.basename(filePath)}`)
    }
  } catch (error) {
    console.log(`    ⚠️  Could not upload file: ${error.message}`)
  }
}

module.exports = {
  fillApplicationForm
}
