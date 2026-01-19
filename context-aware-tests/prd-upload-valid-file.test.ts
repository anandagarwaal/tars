import requests from 'requests';
import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'jest';
import { jestMock } from 'jest-mock';

// Mock the upload API
const uploadApi = jestMock('uploadApi');

describe('PRD Upload - Valid File', () => {
  let token: string;

  // Setup before each test
  beforeEach(async () => {
    // Generate a new token for each test
    const response = await uploadApi.post('/token');
    token = response.data.token;
  });

  afterEach(() => {
    // Reset the mock API after each test
    uploadApi.reset();
  });

  it('should return 200 OK when uploading a valid file', async () => {
    // Create a sample JSON file
    const jsonFile = 'path/to/sample.json';

    // Send a POST request to /upload with the token and file
    const response = await requests.post('/upload', { token, file: jsonFile });

    // Expect the response status code to be 200 OK
    expect(response.status).toBe(200);

    // Verify the uploaded file is in JSON format
    const fileContent = await uploadApi.get(`/file/${response.data.fileId}`);
    expect(fileContent.type).toBe('application/json');
  });
});