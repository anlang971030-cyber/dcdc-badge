export const boardState = { items: [], active: null };
export function addBoardItem(canvas, name='素材') {
  const item={id:Date.now(), canvas, name, x:0.5, y:0.5, scale:1};
  boardState.items.push(item);
  boardState.active=item.id;
  return item;
}
export function getBoardItems(){ return boardState.items; }
export function selectBoardItem(id){ boardState.active=id; }
export function removeBoardItem(id){ boardState.items=boardState.items.filter(i=>i.id!==id); }
