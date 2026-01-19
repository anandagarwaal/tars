import { removeItem } from './removeItem';
import { selectItemToRemove } from './selectItemToRemove';

describe('Remove Item', () => {
  let itemToRemove: any;
  let selectedItemId: string;

  beforeEach(async () => {
    // Set up test data
    itemToRemove = 'test-item';
    selectedItemId = 'test-selected-id';

    // Mock selectItemToRemove function to return the selected id
    jest.mock('./selectItemToRemove', () => ({
      default: jest.fn(() => selectedItemId),
    }));
  });

  afterEach(async () => {
    // Clean up mock functions
    jest.restoreAllMocks();
  });

  it('should remove item successfully', async () => {
    // Act
    const result = await removeItem(itemToRemove);

    // Assert
    expect(result).toBeNull(); // or toEqual(null)
    expect(jest.fn().mock.calls.length).toBe(1); // or toHaveBeenCalled()
  });
});