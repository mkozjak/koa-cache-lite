'use strict'

module.exports.check = function(pattern) {
  if (typeof pattern === 'string' && /[*!?{}(|)[\]]/.test(pattern))
    return true

  return false
}

// this is a modified version of fitzgen/glob-to-regexp to only work with extended globs,
// but also to use the escaped question mark for regex usage
module.exports.toRegExp = function(glob) {
  let inGroup = false, reStr = '', character, string = String(glob)

  for (var i = 0, length = string.length; i < length; i++) {
    character = string[i]

    switch (character) {
      case '\\':
      case '/':
      case '$':
      case '^':
      case '+':
      case '.':
      case '(':
      case ')':
      case '=':
      case '!':
      case '|':
        reStr += '\\' + character
        break

      case '?':
        // chop off last backslash, since we need the question mark
        if (string[i - 1] === '\\') {
          reStr = reStr.substring(0, reStr.length - 1) + '?'
          break
        }

        reStr += '.'
        break

      case '[':
      case ']':
        reStr += character
	    break

      case '{':
        inGroup = true
	    reStr += '('
	    break

      case '}':
        inGroup = false
	    reStr += ')'
	    break

      case ',':
        if (inGroup) {
          reStr += '|'
	      break
        }

        reStr += '\\' + character
        break

      case '*':
        reStr += '.*'
        break

      default:
        reStr += character
    }
  }

  return new RegExp(reStr, 'g')
}
