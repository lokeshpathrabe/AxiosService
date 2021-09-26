import APIService from "./../";
import MockAdapter from "axios-mock-adapter";

const mockFetch = jest.fn(() => Promise.resolve());
const mockOnSessionExpiry = jest.fn(() => Promise.resolve());
const mockRequestInterceptor = jest.fn((req) => req);
const mockResponseSuccessInterceptor = jest.fn((response) => response);
const mockResponseErrorInterceptor = jest.fn((response) => response);

const BaseApiInstance = new APIService(
  {
    timeout: 3000,
    baseURL: "http://example.com/",
  },
  {
    requestInterceptors: [mockRequestInterceptor],
    responseSuccessInterceptors: [mockResponseSuccessInterceptor],
    responseErrorInterceptors: [mockResponseErrorInterceptor],
    tokenRetryCount: 1,
    authFailedStatus: [403],
    checkTokenExpired: (error) => error.data.code === "SESSION_EXPIRED",
    onSessionExpired: (error) => mockOnSessionExpiry(),
    refreshAccessToken: () => {
      // Fetch new auth token
      return mockFetch("http://example.com/fetchToken").then((response) => {
        // Logic to update new token for upcoming API calls
        return response;
      });
    },
  }
);
const mock = new MockAdapter(BaseApiInstance.instance, { delayResponse: 200 });

beforeEach(() => {
  jest.clearAllMocks();
});

test("Test http 200", async () => {
  mock.onGet("http://example.com/fetchData").reply(200, { name: "lokesh" });
  const response = await BaseApiInstance.get("fetchData");
  expect(response.data).toEqual({ name: "lokesh" });
});

test("Test fresh token is fetched for API failed with invalid token error", async () => {
  mock
    .onGet("http://example.com/tokenExpired")
    .replyOnce(403, { code: "SESSION_EXPIRED" });
  mock.onGet("http://example.com/tokenExpired").reply(200, { name: "lokesh" });
  const response = await BaseApiInstance.get("http://example.com/tokenExpired");
  expect(response.data).toEqual({ name: "lokesh" });
  expect(mockFetch).toBeCalledTimes(1);
});

test("Test token is not fetched if checkTokenExpired returns false", async () => {
  mock
    .onGet("http://example.com/tokenExpired")
    .replyOnce(403, { code: "INVALID_ERROR_CODE" });
  mock.onGet("http://example.com/tokenExpired").reply(200, { name: "lokesh" });
  expect(mockFetch).toBeCalledTimes(0);
});

test("Test request interceptor are executed on all requests", async () => {
  const error = await BaseApiInstance.get("fetchDataWithError");
  expect(mockRequestInterceptor).toBeCalledTimes(1);
});

test("Test response success interceptor are executed on successful req", async () => {
  mock.onGet("http://example.com/fetchData").reply(200, { name: "lokesh" });
  const error = await BaseApiInstance.get("fetchData");
  expect(mockResponseSuccessInterceptor).toBeCalledTimes(1);
});

test("Test response error interceptor are executed on failed req", async () => {
  const error = await BaseApiInstance.get("fetchDataWithError");
  expect(mockResponseErrorInterceptor).toBeCalledTimes(1);
});
