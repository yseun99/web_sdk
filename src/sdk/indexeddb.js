import Config from './config'

const _dbName = Config.namespace
const _dbVersion = 1
let _indexedDB
let _db

/**
 * Check if IndexedDB is supported in the current browser (exclude iOS forcefully)
 *
 * @param {boolean=} toThrow
 * @returns {boolean}
 */
function isSupported (toThrow) {
  const indexedDB = _getIDB()
  const iOS = !!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform)
  const supported = !!indexedDB && !iOS

  if (toThrow && !supported) {
    throw Error('IndexedDB is not supported in this browser')
  } else {
    return supported
  }
}

/**
 * Get indexedDB instance
 *
 * @returns {IDBFactory}
 * @private
 */
function _getIDB () {
  return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB
}

/**
 * Open the database connection and create store if not existent
 *
 * @returns {Promise}
 * @private
 */
function _open () {

  _indexedDB = _getIDB()

  isSupported(true)

  return new Promise((resolve, reject) => {

    if (_db) {
      resolve({success: true})
      return
    }

    const request = _indexedDB.open(_dbName, _dbVersion)

    request.onupgradeneeded = e => {

      const db = e.target.result

      e.target.transaction.onerror = reject
      e.target.transaction.onabort = reject

      db.createObjectStore('queue', {keyPath: 'timestamp', autoIncrement: false})
      db.createObjectStore('user', {keyPath: 'uuid', autoIncrement: false})

    }

    request.onsuccess = (e) => {
      _db = e.target.result
      resolve({success: true})
    }

    request.onerror = reject
  })
}

/**
 * Initiate the transaction for requested action
 *
 * @param {string} storeName
 * @param {Object=} target
 * @param {string} action
 * @param {string} [mode=readonly]
 * @returns {Promise}
 * @private
 */
function _initTransaction ({storeName, target, action, mode = 'readonly'}) {
  return _open()
    .then(() => {
      return new Promise((resolve, reject) => {
        const transaction = _db.transaction([storeName], mode)
        const store = transaction.objectStore(storeName)
        const request = store[action](target)

        transaction.onerror = reject
        transaction.onabort = reject

        request.onsuccess = () => {
          if (action === 'get' && !request.result) {
            reject({name: 'NotFoundError', message: `No record found with ${store.keyPath} ${target} in ${storeName} store`})
          } else {
            resolve(request.result || target)
          }
        }
        request.onerror = reject
      })
    })
}

/**
 * Open cursor for bulk operations or listing
 *
 * @param {string} storeName
 * @param {string} action
 * @param {IDBKeyRange=} range
 * @param {boolean=} firstOnly
 * @param {string} [mode=readonly]
 * @returns {Promise}
 * @private
 */
function _openCursor ({storeName, action, range, firstOnly, mode = 'readonly'}) {
  return _open()
    .then(() => {
      return new Promise((resolve, reject) => {

        const transaction = _db.transaction([storeName], mode)
        const store = transaction.objectStore(storeName)
        const cursorRequest = store.openCursor(range)
        const items = []

        transaction.oncomplete = () => resolve(firstOnly ? items[0] : items)
        transaction.onerror = reject
        transaction.onabort = reject

        cursorRequest.onsuccess = e => {

          const cursor = e.target.result

          if (cursor) {
            items.push(cursor.value)

            if (action === 'delete') {
              cursor.delete()
            }

            if (!firstOnly) {
              cursor.continue()
            }
          }
        }

        cursorRequest.onerror = reject
      })
    })
}

/**
 * Get all records from particular store
 *
 * @param {string} storeName
 * @param {boolean=} firstOnly
 * @returns {Promise}
 */

function getAll (storeName, firstOnly) {
  return _openCursor({storeName, action: 'list', firstOnly})
}

/**
 * Get the first row from the store
 *
 * @param {string} storeName
 * @returns {Promise}
 */
function getFirst (storeName) {
  return getAll(storeName, true)
}

/**
 * Get item from a particular store
 *
 * @param {string} storeName
 * @param {*} id
 * @returns {Promise}
 */
function getItem (storeName, id) {
  return _initTransaction({storeName, target: id, action: 'get'})
}

/**
 * Add item to a particular store
 *
 * @param {string} storeName
 * @param {Object} item
 * @returns {Promise}
 */
function addItem (storeName, item) {
  return _initTransaction({storeName, target: item, action: 'add', mode: 'readwrite'})
}

/**
 * Update item in a particular store
 *
 * @param {string} storeName
 * @param {Object} item
 * @returns {Promise}
 */
function updateItem (storeName, item) {
  return _initTransaction({storeName, target: item, action: 'put', mode: 'readwrite'})
}

/**
 * Delete item from a particular store
 *
 * @param {string} storeName
 * @param {*} id
 * @returns {Promise}
 */
function deleteItem (storeName, id) {
  return _initTransaction({storeName, target: id, action: 'delete', mode: 'readwrite'})
}

/**
 * Delete items until certain bound (primary key as a bound scope)
 *
 * @param {string} storeName
 * @param {*} upperBound
 * @returns {Promise}
 */
function deleteBulk (storeName, upperBound) {

  const range = IDBKeyRange.upperBound(upperBound)

  return _openCursor({storeName, action: 'delete', range, mode: 'readwrite'})
}

/**
 * Clear all records from a particular store
 *
 * @param {string} storeName
 * @returns {Promise}
 */
function clear (storeName) {
  return _initTransaction({storeName, action: 'clear', mode: 'readwrite'})
}

/**
 * Close the database and destroy the reference to it
 */
function destroy () {
  _db.close()
  _db = null
}

export default {
  isSupported,
  getAll,
  getFirst,
  getItem,
  addItem,
  updateItem,
  deleteItem,
  deleteBulk,
  clear,
  destroy
}

