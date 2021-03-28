class APILockService {
  constructor() {
    this.locked = false;
  }

  lock = () => {
    if (this.locked) {
      throw new Error("APIService has already been locked.");
    }
    this.locked = true;
    this.waitPromise = new Promise((resolve, _reject) => {
      this.resolveWaitPromise = () => {
        resolve();
      };
      setTimeout(() => {
        this.locked = false;
        resolve();
      }, 300000); // timeout after 5 mins
    });
  };

  isLocked = (config) => {
    if (config.skipLock) {
      return false;
    }
    return this.locked;
  };

  releaseLock = () => {
    this.locked = false;
    if (typeof this.resolveWaitPromise === "function") {
      this.resolveWaitPromise();
    }
  };

  waitTillUnlocked = () => this.waitPromise;
}

export default new APILockService();
