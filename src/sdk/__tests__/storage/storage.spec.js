import * as Logger from '../../logger'

jest.mock('../../logger')

describe('test storage availability', () => {

  function mockAvailability (idbSupport, lsSupport) {
    jest.doMock('../../storage/indexeddb', () => ({
      isSupported () { return idbSupport }
    }))
    jest.doMock('../../storage/localstorage', () => ({
      isSupported () { return lsSupport }
    }))
  }

  beforeAll(() => {
    jest.spyOn(Logger.default, 'error')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  it('reports that there is no storage available', () => {

    expect.assertions(2)

    jest.isolateModules(() => {
      mockAvailability(false, false)

      const Storage = require('../../storage/storage').default

      expect(Storage).toBeNull()
      expect(Logger.default.error).toHaveBeenCalledWith('There is no storage available, app will run with minimum set of features')
    })
  })

  it('sets indexedDB as available storage', () => {

    expect.assertions(2)

    jest.isolateModules(() => {
      mockAvailability(true, false)

      const Storage = require('../../storage/storage').default

      expect(Storage).not.toBeNull()
      expect(Storage.type).toBe('indexedDB')
    })
  })

  it('sets localStorage as available storage', () => {

    expect.assertions(2)

    jest.isolateModules(() => {
      mockAvailability(false, true)

      const Storage = require('../../storage/storage').default

      expect(Storage).not.toBeNull()
      expect(Storage.type).toBe('localStorage')
    })
  })

  it('prefers indexedDB over localStorage as available storage', () => {

    expect.assertions(2)

    jest.isolateModules(() => {
      mockAvailability(true, true)

      const Storage = require('../../storage/storage').default

      expect(Storage).not.toBeNull()
      expect(Storage.type).toBe('indexedDB')
    })
  })

})

