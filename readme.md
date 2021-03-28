# AxiosService

Library that helps you implement automatic refresh of authorization via axios [interceptors](https://github.com/axios/axios#interceptors). You can easily intercept the original request when it fails, refresh the authorization and continue with the original request, without any user interaction.

What happens when the request fails due to authorization is all up to you. You can either run a refresh call for a new authorization token or run a custom logic.

Create axios instance using this library and make API calls as you would do. Just provide some configuration needed to fetch the auth token and the library takes care of all scenarios related to auth failure.

Note: The API must return HTTP error status when auth fails. If your api return HTTP200 on auth failure this lib will not work.

## Installation

TBU

## Usage

Create a new axios instance like below

```js
const apiServiceConfig = {

};

/**
 * Axios Instance
 */

export const BaseApiInstance = new AxiosService(
  {
    timeout: 300000,
    baseURL: 'https://baseAPi.url/',
  },
  {
	  requestInterceptors: [...],
	  responseSuccessInterceptors: [...],
	  responseErrorInterceptors: [...],
	  tokenRetryCount: 1,
	  checkTokenExpired: (error) => error.response.data.code === 'SESSION_EXPIRED'
	  onSessionExpired: (error) => redirectToUrl(error.response.data.redirectUrl)
	  refreshAccessToken: () => {
		 // Fetch new auth token
		const response = fetch('https://tokne-url/get')
		.then(response => response.json());
		// Logic to update new token for upcoming API calls
	}
  },
);
```

## Params

- `authFailedStatus*`: (mandatory) Array of status to check for expired auth token eg `[403, 402]`. The status must be a error status.
- `checkTokenExpired`: (optional) Function to give custom logic to identify auth failure in API. axios error object is passed as param to this function.

```js
const checkTokenExpired = (error) => {
  const { status, data } = error.response;
  const { code } = data || {};
  return (
    HTTP_STATUS.ACCESS_TOKEN_INVALID_STATUS.indexOf(status) > -1 ||
    SESSION_EXPIRED_ERRORS.indexOf(code) > -1
  );
};
```

- `tokenRetryCount`: (optional) (Default: 1)Number of time auth token call should be retried incase we get `authFailedStatus` or true `checkTokenExpired` in response of call made by `refreshAccessToken`
- `refreshAccessToken`: (mandatory) Function with logic to make the API call for auth token. This function must return a Promise. If you use try-catch block you must rethrow Promise.reject from catch block to make the retry of refreshAccessToken work.
- `onSessionExpired`: (optional) Function with logic of what to do when session expired and auth token fails in all `tokenRetryCount` attempts.
- `requestInterceptors`: (optional) Array with request interceptors for axios
- `responseSuccessInterceptors`:: (optional) Array with response interceptors for axios when API return HTTP200
- `responseErrorInterceptors`:(optional) Array with response interceptors for axios when API return error
