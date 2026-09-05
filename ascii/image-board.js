export const boardState = { items: [], active: null };

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function addBoardItem(canvas, name = '素材', previewUrl = '') {
  const item = {
    id: uid(),
    canvas,
    previewUrl,
    name,
    x: 0.5,
    y: 0.5,
    scale: 1,
    baseScale: 1
  };
  boardState.items.push(item);
  boardState.active = item.id;
  return item;
}

export function selectBoardItem(id) {
  boardState.active = id;
}

export function getActiveBoardItem() {
  return boardState.items.find(item => item.id === boardState.active) || null;
}

export function removeBoardItem(id) {
  const target = boardState.items.find(item => item.id === id);
  if (target?.previewUrl) {
    try { URL.revokeObjectURL(target.previewUrl); } catch {}
  }
  boardState.items = boardState.items.filter(item => item.id !== id);
  if (boardState.active === id) boardState.active = boardState.items.at(-1)?.id || null;
}

export function clearBoardItems() {
  boardState.items.forEach(item => {
    if (item.previewUrl) {
      try { URL.revokeObjectURL(item.previewUrl); } catch {}
    }
    if (item.canvas) item.canvas.width = item.canvas.width;
  });
  boardState.items = [];
  boardState.active = null;
}

export function updateBoardItem(id, key, value) {
  const item = boardState.items.find(entry => entry.id === id);
  if (!item) return;
  if (key === 'scale') {
    item.scale = Number(value);
    return;
  }
  if (key === 'baseScale') {
    item.baseScale = Number(value);
    return;
  }
  if (key === 'x' || key === 'y') {
    item[key] = Number(value);
    return;
  }
  item[key] = value;
}

export function moveBoardItem(id, direction) {
  const index = boardState.items.findIndex(item => item.id === id);
  if (index < 0) return;
  const targetIndex = direction === 'up'
    ? Math.min(boardState.items.length - 1, index + 1)
    : Math.max(0, index - 1);
  if (targetIndex === index) return;
  const [item] = boardState.items.splice(index, 1);
  boardState.items.splice(targetIndex, 0, item);
  boardState.active = item.id;
}

export function getBoardItems() {
  return boardState.items;
}
