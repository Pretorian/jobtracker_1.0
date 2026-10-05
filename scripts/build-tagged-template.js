/*
 * Rebuilds data/master-resume-template.docx as a docxtemplater-ready template.
 *
 * The original template was static prose with zero merge fields, so
 * docxtemplater had nothing to substitute and every "optimized" resume came
 * out byte-for-byte identical to the master. This script swaps the document
 * body for headings + placeholder tags that match the fields produced by
 * server/resume/optimized-generator.js, while preserving the existing header
 * (name/contact), styles, fonts and numbering already wired up in the .docx.
 */
const fs = require('fs')
const path = require('path')
const PizZip = require('pizzip')

const TEMPLATE = path.join(__dirname, '../data/master-resume-template.docx')

const RPR_BODY =
  '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>'
const RPR_HEAD =
  '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:bCs/></w:rPr>'

// Centered bold heading paragraph, matching the original "Areas of Expertise" style.
function heading(text) {
  return (
    '<w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="9990"/></w:tabs>' +
    '<w:spacing w:before="160"/><w:jc w:val="center"/>' +
    RPR_HEAD +
    '</w:pPr><w:r>' +
    RPR_HEAD +
    `<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`
  )
}

// Normal body paragraph carrying a placeholder tag (or literal text).
function body(text) {
  return (
    '<w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="9990"/></w:tabs>' +
    RPR_BODY +
    '</w:pPr><w:r>' +
    RPR_BODY +
    `<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`
  )
}

const newBody = [
  body('Tailored for {targetRole} at {targetCompany} ({targetLocation}) — {date}'),
  heading('Objective'),
  body('{objective}'),
  heading('Professional Summary'),
  body('{summary}'),
  heading('Areas of Expertise'),
  body('{skills}'),
  heading('Key Achievements'),
  body('{keyAchievements}'),
  heading('Professional Experience'),
  body('{relevantExperience}'),
].join('')

const zip = new PizZip(fs.readFileSync(TEMPLATE, 'binary'))
let xml = zip.file('word/document.xml').asText()

const sectPr = (xml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/) || [''])[0]
const bodyAttrs = (xml.match(/<w:body([^>]*)>/) || [, ''])[1]

xml = xml.replace(
  /<w:body[^>]*>[\s\S]*<\/w:body>/,
  `<w:body${bodyAttrs}>${newBody}${sectPr}</w:body>`
)

zip.file('word/document.xml', xml)
fs.writeFileSync(TEMPLATE, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }))
console.log('Rebuilt tagged template at', TEMPLATE)
