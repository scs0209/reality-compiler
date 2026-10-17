import { describe, expect, it } from 'vitest';
import type { ObjectCategory } from '../shared/roomGraphSchema';
import { kindOf } from '../src/sceneKinds';

const node = (label: string, category: ObjectCategory = 'furniture', labelKo = label) => ({
  label,
  labelKo,
  category,
});

describe('kindOf (procedural 3D model choice)', () => {
  it('maps the sample-room furniture to recognisable models', () => {
    expect(kindOf(node('Queen Bed Frame'))).toBe('bed');
    expect(kindOf(node('Standing Desk 1400'))).toBe('desk');
    expect(kindOf(node('Ergonomic Mesh Chair'))).toBe('chair');
    expect(kindOf(node('Sliding Wardrobe 1200'))).toBe('wardrobe');
    expect(kindOf(node('Standing Floor Lamp'))).toBe('lamp');
    expect(kindOf(node('Deep L-Sectional Couch'))).toBe('sofa');
    expect(kindOf(node('Oak Coffee Table'))).toBe('desk');
    expect(kindOf(node('Bedside Table'))).toBe('desk');
  });

  it('prefers the specific word over the generic one', () => {
    // "TV Stand" and "Media Console" are low cabinets, not screens; "Bookshelf" is not a table.
    expect(kindOf(node('TV Stand'))).toBe('cabinet');
    expect(kindOf(node('Media stand'))).toBe('cabinet');
    expect(kindOf(node('Media Console & Bookshelf'))).toBe('cabinet');
    expect(kindOf(node('Server Rack 12U'))).toBe('cabinet');
    expect(kindOf(node('5-Tier Shelf'))).toBe('shelf');
    expect(kindOf(node('Monitor 27 inch'))).toBe('monitor');
  });

  it('treats any appliance-category object as an appliance, and Korean names work', () => {
    expect(kindOf(node('Mini Fridge (Occluded)', 'appliance'))).toBe('appliance');
    expect(kindOf(node('WashTower', 'appliance'))).toBe('appliance');
    expect(kindOf(node('Thing', 'appliance'))).toBe('appliance');
    expect(kindOf(node('x', 'furniture', '퀸 침대'))).toBe('bed');
    expect(kindOf(node('x', 'furniture', '옷장'))).toBe('wardrobe');
  });

  it('falls back to a plain box for labels it does not know', () => {
    expect(kindOf(node('Cube'))).toBe('box');
    expect(kindOf(node('Box'))).toBe('box');
  });
});
