import type { RoomObjectNode } from '../shared/roomGraphSchema';

export type Kind =
  | 'bed'
  | 'sofa'
  | 'chair'
  | 'desk'
  | 'wardrobe'
  | 'cabinet'
  | 'shelf'
  | 'appliance'
  | 'lamp'
  | 'monitor'
  | 'plant'
  | 'box';

// Chooses a procedural model for the 3D view from an object's label. Order matters: the more
// specific words (wardrobe, cabinet, console) are checked before the generic ones (table, tv).
// Anything unknown becomes a plain rounded box.
export function kindOf(node: Pick<RoomObjectNode, 'label' | 'labelKo' | 'category'>): Kind {
  const s = `${node.label} ${node.labelKo}`.toLowerCase();
  if (/\bbeds?\b|침대/.test(s)) return 'bed';
  if (/sofa|couch|소파/.test(s)) return 'sofa';
  if (/chair|stool|의자/.test(s)) return 'chair';
  if (/wardrobe|closet|dresser|옷장|서랍장/.test(s)) return 'wardrobe';
  // \bstand\b so that "Standing Desk" and "Standing Lamp" are not mistaken for a TV stand
  if (/cabinet|console|\bstand\b|\brack\b|storage|trunk|캐비닛|수납/.test(s)) return 'cabinet';
  if (/shelf|bookcase|bookshelf|책장|선반/.test(s)) return 'shelf';
  if (/\bdesks?\b|\btables?\b|책상|테이블/.test(s)) return 'desk';
  if (/fridge|refrigerator|washer|dryer|oven|냉장고|세탁|건조/.test(s) || node.category === 'appliance')
    return 'appliance';
  if (/\blamp|\blight\b|조명|램프/.test(s)) return 'lamp';
  if (/monitor|\btv\b|screen|모니터/.test(s)) return 'monitor';
  if (/plant|화분|식물/.test(s)) return 'plant';
  return 'box';
}
