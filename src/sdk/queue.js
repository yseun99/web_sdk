import SchemeMap from './storage/scheme-map'
import Config from './config'
import StorageManager from './storage/storage-manager'
import ActivityState from './activity-state'
import Logger from './logger'
import Package from './package'
import {extend, isRequest} from './utilities'
import {persist} from './identity'
import {getTimestamp} from './time'

/**
 * Package request instance
 *
 * @type {Object}
 * @private
 */
const _request = Package({
  strategy: 'long',
  continueCb: _continue
})

/**
 * Check if in offline mode
 *
 * @type {boolean}
 * @private
 */
let _isOffline = false

/**
 * Name of the store used by queue
 *
 * @type {string}
 * @private
 */
const _storeName = SchemeMap.storeNames.queue

/**
 * Remove from the top and continue running pending requests
 *
 * @returns {Promise}
 * @private
 */
function _continue () {
  return StorageManager.getFirst(_storeName)
    .then(pending => pending ? StorageManager.deleteItem(_storeName, pending.timestamp) : null)
    .then(() => {
      _request.finish()
      return run()
    })
}

/**
 * Prepare parameters which are about to be sent with the request
 *
 * @param url
 * @param params
 * @returns {any}
 * @private
 */
function _prepareParams (url, params) {
  const baseParams = extend({
    createdAt: getTimestamp()
  }, isRequest(url, 'event') ? {
    eventCount: ActivityState.current.eventCount || 1
  } : {})

  return extend(baseParams, ActivityState.getParams(), params)
}

/**
 * Persist activity state change with session offset reset after session request
 *
 * @param {string} url
 * @returns {Promise}
 * @private
 */
function _persist (url) {

  if (isRequest(url, 'session')) {
    ActivityState.resetSessionOffset()
  }

  ActivityState.updateLastActive()

  return persist()
}

/**
 * Push request to the queue
 *
 * @param {string} url
 * @param {string} method
 * @param {Object=} params
 * @param {boolean=} auto
 * @param {boolean=} cleanUp
 * @returns {Promise}
 */
function push ({url, method, params}, {auto, cleanUp} = {}) {

  ActivityState.updateParams(url, auto)

  params = _prepareParams(url, params)

  const pending = extend({timestamp: Date.now()}, {url, method, params})

  return StorageManager.addItem(_storeName, pending)
    .then(() => _persist(url))
    .then(() => _request.isRunning() ? {} : run(cleanUp))
}

/**
 * Prepare to send pending request if available
 *
 * @param {string=} url
 * @param {string=} method
 * @param {Object=} params
 * @returns {Promise}
 * @private
 */
function _prepareToSend ({url, method, params} = {}) {
  const activityState = ActivityState.current || {}
  const firstSession = url === '/session' && !activityState.attribution
  const noPending = !url && !method && !params

  if (_isOffline && !firstSession || noPending) {
    return Promise.resolve({})
  }

  return _request.send({url, method, params})
}

/**
 * Run all pending requests
 *
 * @param {boolean=false} cleanUp
 * @returns {Promise}
 */
function run (cleanUp) {
  let chain = Promise.resolve({})

  if (cleanUp) {
    chain = chain.then(_cleanUp)
  }

  return chain
    .then(() => StorageManager.getFirst(_storeName))
    .then(_prepareToSend)
}

/**
 * Set offline mode to on or off
 * - if on then all requests are queued
 * - if off then run all pending requests
 *
 * @param {boolean=false} state
 */
function setOffline (state = false) {

  if (state === _isOffline) {
    Logger.error(`The app is already in ${(state ? 'offline' : 'online')} mode`)
    return
  }

  const wasOffline = _isOffline

  _isOffline = state

  if (!state && wasOffline) {
    run()
  }

  Logger.info(`The app is now in ${(state ? 'offline' : 'online')} mode`)
}

/**
 * Clean up stale pending requests
 *
 * @private
 * @returns {Promise}
 */
function _cleanUp () {
  const upperBound = Date.now() - Config.requestValidityWindow
  return StorageManager.deleteBulk(_storeName, {upperBound})
}

/**
 * Check if there is pending timeout to be flushed
 * i.e. if queue is running
 *
 * @returns {boolean}
 */
function isRunning () {
  return _request.isRunning()
}

/**
 * Clear queue store
 */
function clear () {
  return StorageManager.clear(_storeName)
}

/**
 * Destroy queue by clearing current timeout
 */
function destroy () {
  _request.clear()
}

export {
  push,
  run,
  setOffline,
  isRunning,
  clear,
  destroy
}
