/*
 * Minimal dependency-free line diff (LCS based). Returns an array of
 * { type: 'added' | 'removed' | 'unchanged', value } in document order.
 * Used to show what the AI changed between the master resume template and a
 * generated/optimized resume.
 */
function diffLines(beforeText, afterText) {
  const a = splitLines(beforeText)
  const b = splitLines(afterText)
  const n = a.length
  const m = b.length

  // LCS length table.
  const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const out = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'unchanged', value: a[i] })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ type: 'removed', value: a[i] })
      i++
    } else {
      out.push({ type: 'added', value: b[j] })
      j++
    }
  }
  while (i < n) out.push({ type: 'removed', value: a[i++] })
  while (j < m) out.push({ type: 'added', value: b[j++] })
  return out
}

function splitLines(text) {
  return (text || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

module.exports = { diffLines }
