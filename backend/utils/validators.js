const { body } = require('express-validator');

/**
 * Minimum viable password policy: 8+ characters, at least one
 * uppercase letter, one lowercase letter, and one number. Deliberately
 * not requiring a symbol -- that tends to push people toward
 * "Password1!" rather than meaningfully stronger passwords, for
 * real usability cost.
 *
 * @param {string} field - the body field name to validate
 */
const passwordStrength = (field = 'password') =>
  body(field)
    .isStrongPassword({
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 0,
    })
    .withMessage('Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number');

module.exports = { passwordStrength };
