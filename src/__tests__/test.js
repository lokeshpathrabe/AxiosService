import APIService from './../';
import MockAdapter from 'axios-mock-adapter';

const BaseApiInstance = new APIService(
    {
      timeout: 30000,
      baseURL: 'https://baseAPi.url/',
    },
    {
        tokenRetryCount: 1,
        authFailedStatus: [403, 401],
        checkTokenExpired: (error) => error.response.data.code === 'SESSION_EXPIRED',
        onSessionExpired: (error) => redirectToUrl(error.response.data.redirectUrl),
        refreshAccessToken: () => {
           // Fetch new auth token
          const response = fetch('https://tokne-url/get')
          .then(response => response.json());
          // Logic to update new token for upcoming API calls
      }
    },
  );
const mock = new MockAdapter(BaseApiInstance.instance)

beforeAll(() => {
    mock.onGet('http://example.com/fetchData').reply(200, {name: "lokesh"})
})

test('Test get call', async () => {
    const response = await BaseApiInstance.get('http://example.com/fetchData');
    expect(response.data).toEqual({name: "lokesh"})
})