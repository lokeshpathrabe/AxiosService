import axios from "axios";
import defaultConfig from "./defaultConfiguration";
import APILockService from "./APILockService";

/**
 * Creates a axios instance and adds request and response interceptors to handle
 * 1. Auth token auto refresh on failure
 * 2. Failed API retry on fetching fresh auth token
 * 3. Handles parallel API calls failing due to expired token.
 *    Only one call is made to fetch fresh token and all other APIs are retried
 *
 */
class APIService {
  /**
   *
   * @param {object} axiosCfg axios config
   * @param {object} config AxiosService config.
   */
  constructor(axiosCfg, config) {
    const {
      authFailedStatus,
      checkTokenExpired,
      tokenRetryCount,
      refreshAccessToken,
      onSessionExpired,
      requestInterceptors = [],
      responseSuccessInterceptors = [],
      responseErrorInterceptors = [],
    } = config;

    this.AUTH_FAILED_STATUS = authFailedStatus;
    this.ACCESS_TOKEN_RETRY_COUNT = tokenRetryCount;
    this.refreshAccessToken = refreshAccessToken;
    this.onSessionExpired = onSessionExpired;
    this.checkTokenExpired = checkTokenExpired;

    if (typeof axiosCfg === "string") {
      const baseURL = axiosCfg;
      axiosCfg = {};
      axiosCfg.baseURL = baseURL;
    } else {
      axiosCfg = axiosCfg || {};
    }
    this.instance = axios.create({
      ...this.defaultConfiguration(),
      ...axiosCfg,
    });

    const reqInterceptors = [
      this.apiRequestLockInterceptor,
      ...requestInterceptors,
    ];
    reqInterceptors.forEach((interceptor) => {
      this.instance.interceptors.request.use(interceptor);
    });

    if (responseSuccessInterceptors?.length) {
      responseSuccessInterceptors.forEach((interceptor) => {
        this.instance.interceptors.response.use(interceptor);
      });
    }

    const resErrorInterceptors = [
      this.authErrorResponseErrorInterceptor.bind(this),
      ...responseErrorInterceptors,
    ];
    resErrorInterceptors.forEach((interceptor) => {
      this.instance.interceptors.response.use(
        (response) => response,
        interceptor
      );
    });
  }

  isAuthFailed(response) {
    if (typeof this.checkTokenExpired === "function") {
      return this.checkTokenExpired(response);
    }
    const { status } = response;
    return this.AUTH_FAILED_STATUS.indexOf(status) > -1;
  }

  async callRefreshToken(tokenRetryCount = 0) {
    try {
      const response = await this.refreshAccessToken({
        skipAccessTokenRetry: true,
        tokenRetryCount,
      });
      return response;
    } catch (error) {
      const { config, response } = error;

      if (!this.isAuthFailed(response)) {
        return Promise.reject(error);
      }

      if (config.tokenRetryCount < this.ACCESS_TOKEN_RETRY_COUNT) {
        return this.callRefreshToken(config.tokenRetryCount + 1);
      } else {
        if (typeof this.onSessionExpired === "function") {
          return this.onSessionExpired(error);
        }
      }
    }
  }

  async retryFailedRequest(error) {
    const { config } = error.response;
    //We store the original urls in config object in apiRequestLockInterceptor
    if (!config.skipApiRetry) {
      config.baseURL = config.requestedBaseUrl;
      config.url = config.requestedUrl;
      config.skipApiRetry = true; // To prevent endless retry of API failing with valid accesstoken
      const response = await this.instance.request(config);
      return response;
    }
    return Promise.reject(error);
  }

  async authErrorResponseErrorInterceptor(error) {
    //Get new access token and retry request.
    const { config } = error.response;

    if (!config) {
      Promise.reject(error);
    }
    const { skipAccessTokenRetry = false } = config;

    if (skipAccessTokenRetry || !this.isAuthFailed(error.response)) {
      return Promise.reject(error);
    }

    if (APILockService.isLocked(config)) {
      await APILockService.waitTillUnlocked();
    } else {
      APILockService.lock();
      await this.callRefreshToken();
      APILockService.releaseLock();
    }
    return this.retryFailedRequest(error);
  }

  async apiRequestLockInterceptor(config) {
    if (APILockService.isLocked(config)) {
      await APILockService.waitTillUnlocked();
    }
    config.requestedBaseUrl = config.baseURL;
    config.requestedUrl = config.url;
    return config;
  }

  // Consumer can use this function to get defaultConfiguration for service (each instance)
  // Instance configuration cannot be changed at runtime.
  // Use updateDefaultConfiguration for instance configuration changes
  defaultConfiguration = () => {
    // Programatically update configuration, for future use.
    return defaultConfig;
  };

  get config() {
    return this.instance.default;
  }

  get requestInterceptors() {
    return this.instance.interceptors.request;
  }

  get responseInterceptors() {
    return this.instance.interceptors.response;
  }

  request = (config) => {
    return this.instance.request(config);
  };

  get = (url, config) => {
    return this.instance.get(url, config);
  };

  delete = (url, config) => {
    return this.instance.delete(url, config);
  };

  head = (url, config) => {
    return this.instance.head(url, config);
  };

  options = (url, config) => {
    return this.instance.options(url, config);
  };

  post = (url, data, config) => {
    return this.instance.post(url, data, config);
  };

  put = (url, data, config) => {
    return this.instance.put(url, data, config);
  };

  patch = (url, data, config) => {
    return this.instance.patch(url, data, config);
  };

  // This are calls for concurrency/parallel calls
  // Todo: This could had been static methods instead of instance methods
  all = (iterable) => {
    return axios.all(iterable);
  };

  allSettled = (iterable) => {
    // return Promise.allSettled(iterable);
    // Intentionally, fallback, since polyfill should work. If it doesn't work this should be reported during module initialization

    return Promise.allSettled
      ? Promise.allSettled(iterable)
      : this.all(iterable);
  };
  spread = (callback) => {
    return axios.spread(callback);
  };
}

if (!Promise.allSettled) {
  // eslint-disable-next-line no-console
  console.warn(
    "API Service requires `Promise.allSettled` native API. `APIInstance.allSettled` function may misbehave and would fallback on `Promise.all`"
  );
}

export default APIService;
