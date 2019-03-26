import Storage from './storage'

/**
 * Generate random  uuid v4
 *
 * @returns {string}
 * @private
 */
function _generateUuid () {
  let seed = Date.now()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (seed + Math.random() * 16) % 16 | 0
    seed = Math.floor(seed / 16)
    return (c === 'x' ? r : r & (0x3|0x8)).toString(16)
  })
}

/**
 * Get current user's record
 *
 * @returns {Promise}
 */
export default function identity () {
  return Storage.getFirst('user')
    .then(user => user ? user : Storage.addItem('user', {uuid: _generateUuid()}))
}
