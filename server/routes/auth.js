const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const {
  getUserByUsername,
  verifyPassword,
  updateUserPassword,
} = require('../db/database')

// Validation middleware
const validateInput = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() })
  }
  next()
}

// POST /api/auth/login - Login
router.post('/login',
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  validateInput,
  (req, res) => {
    try {
      const { username, password } = req.body

      const user = getUserByUsername(username)

      if (!user || !verifyPassword(password, user.password)) {
        // Use same message for both cases to prevent username enumeration
        return res.status(401).json({ error: 'Invalid username or password' })
      }

      // Create session
      req.session.userId = user.id
      req.session.username = user.username

      console.log(`✅ User logged in: ${username}`)

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username
        }
      })
    } catch (error) {
      console.error('Login error:', error)
      res.status(500).json({ error: 'Login failed' })
    }
  }
)

// POST /api/auth/logout - Logout
router.post('/logout', (req, res) => {
  const username = req.session.username
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err)
      return res.status(500).json({ error: 'Logout failed' })
    }

    console.log(`✅ User logged out: ${username}`)
    res.json({ success: true, message: 'Logged out successfully' })
  })
})

// GET /api/auth/me - Get current user
router.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  res.json({
    user: {
      id: req.session.userId,
      username: req.session.username
    }
  })
})

// POST /api/auth/change-password - Change password
router.post('/change-password',
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .notEmpty().withMessage('New password is required')
      .isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    body('confirmPassword')
      .notEmpty().withMessage('Confirm password is required')
      .custom((value, { req }) => value === req.body.newPassword)
      .withMessage('Passwords do not match')
  ],
  validateInput,
  (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' })
      }

      const { currentPassword, newPassword } = req.body
      const username = req.session.username

      const user = getUserByUsername(username)

      if (!user || !verifyPassword(currentPassword, user.password)) {
        return res.status(401).json({ error: 'Current password is incorrect' })
      }

      updateUserPassword(username, newPassword)

      console.log(`✅ Password changed for user: ${username}`)

      res.json({
        success: true,
        message: 'Password changed successfully'
      })
    } catch (error) {
      console.error('Change password error:', error)
      res.status(500).json({ error: 'Failed to change password' })
    }
  }
)

module.exports = router
