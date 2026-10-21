// Turns a photo the user picked into a small portrait for a character: cropped to 3:4 (the shape of the
// character cards), scaled to AVATAR_WIDTH × AVATAR_HEIGHT and stored as a JPEG data URL inside the
// character itself, so it syncs and backs up with no separate file storage.

export const AVATAR_WIDTH = 450;
export const AVATAR_HEIGHT = 600;
const JPEG_QUALITY = 0.82;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode failed'));
    img.src = src;
  });
}

export async function imageFileToAvatar(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('not an image');
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) throw new Error('empty image');

    // Cover-crop to 3:4. A tall photo keeps more of its top, where faces usually are.
    const target = AVATAR_WIDTH / AVATAR_HEIGHT;
    let sx = 0;
    let sy = 0;
    let sw = w;
    let sh = h;
    if (w / h > target) {
      sw = h * target;
      sx = (w - sw) / 2;
    } else {
      sh = w / target;
      sy = (h - sh) * 0.3;
    }

    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_WIDTH;
    canvas.height = AVATAR_HEIGHT;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, AVATAR_WIDTH, AVATAR_HEIGHT);
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(url);
  }
}
