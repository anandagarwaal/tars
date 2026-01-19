import { expect } from 'chai';
import { ItemService } from './ItemService';

describe('Add item happy path', () => {
  let itemService: ItemService;
  let itemId = 'test-item-id';
  let itemName = 'Test Item Name';
  let price = 10.99;

  beforeEach(() => {
    itemService = new ItemService();
  });

  afterEach(async () => {
    // Clean up any mocks or setup
  });

  it('should add an item successfully', async () => {
    // Act
    const result = await itemService.addItem(itemName, price);

    // Assert
    expect(result).toBe(true);
    expect(itemService.items).toHaveSize(1);
    expect(itemService.items[0].id).toBe(itemId);
    expect(itemService.items[0].name).toBe(itemName);
    expect(itemService.items[0].price).toBe(price);
  });

  it('should return an error if item name is empty', async () => {
    // Act
    const result = await itemService.addItem('', price);

    // Assert
    expect(result).toBe(false);
    expect(itemService.items).toHaveSize(0);
  });
});