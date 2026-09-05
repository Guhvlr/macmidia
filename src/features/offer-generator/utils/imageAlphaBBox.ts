export interface AlphaBBox {
  x: number;
  y: number;
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
}

const ALPHA_THRESHOLD = 10;
const cache = new Map<string, Promise<AlphaBBox>>();

function fullBox(w: number, h: number): AlphaBBox {
  return { x: 0, y: 0, width: w, height: h, naturalWidth: w, naturalHeight: h };
}

export function getImageAlphaBBox(src: string): Promise<AlphaBBox> {
  if (!src) return Promise.resolve(fullBox(1, 1));

  const cached = cache.get(src);
  if (cached) return cached;

  const promise = new Promise<AlphaBBox>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      try {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(fullBox(w, h)); return; }

        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, w, h);

        let minX = w, minY = h, maxX = -1, maxY = -1;
        for (let y = 0; y < h; y++) {
          const rowOffset = y * w * 4;
          for (let x = 0; x < w; x++) {
            const alpha = data[rowOffset + x * 4 + 3];
            if (alpha > ALPHA_THRESHOLD) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (maxX < minX || maxY < minY) {
          resolve(fullBox(w, h));
          return;
        }

        resolve({
          x: minX,
          y: minY,
          width: maxX - minX + 1,
          height: maxY - minY + 1,
          naturalWidth: w,
          naturalHeight: h,
        });
      } catch {
        resolve(fullBox(w, h));
      }
    };

    img.onerror = () => resolve(fullBox(1, 1));
    img.src = src;
  });

  cache.set(src, promise);
  return promise;
}
