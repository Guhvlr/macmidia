export const applyImageAdjustment = async (
  imageUrl: string,
  adjustment: any,
  targetRatio: number
): Promise<string> => {
  if (!adjustment) return imageUrl;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Important for external URLs
    
    img.onerror = () => {
      console.error('Failed to load image for processing due to CORS or network error.');
      resolve(imageUrl); // Fallback to original image
    };

    img.src = imageUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        
        // Define base width based on common social media resolution
        const targetWidth = 1080;
        const targetHeight = targetWidth / targetRatio;
        
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');
        
        if (adjustment.mode === 'fit') {
          // Draw background
          if (adjustment.fillType === 'blur') {
            // Draw blurred background
            ctx.filter = 'blur(40px)';
            // Calculate cover dimensions for background
            const bgRatio = img.width / img.height;
            let bgW = targetWidth;
            let bgH = targetHeight;
            let bgX = 0;
            let bgY = 0;
            if (bgRatio > targetRatio) {
               bgW = targetHeight * bgRatio;
               bgX = (targetWidth - bgW) / 2;
            } else {
               bgH = targetWidth / bgRatio;
               bgY = (targetHeight - bgH) / 2;
            }
            // Scale up slightly to avoid blur edges
            ctx.drawImage(img, bgX - bgW*0.05, bgY - bgH*0.05, bgW*1.1, bgH*1.1);
            ctx.filter = 'none'; // reset
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; // darken slightly
            ctx.fillRect(0, 0, targetWidth, targetHeight);
          } else {
            ctx.fillStyle = adjustment.fillType === 'white' ? '#FFFFFF' : 
                            adjustment.fillType === 'color' ? adjustment.fillColor : '#000000';
            ctx.fillRect(0, 0, targetWidth, targetHeight);
          }
          
          // Draw main image fitted
          const imgRatio = img.width / img.height;
          let drawW = targetWidth;
          let drawH = targetHeight;
          if (imgRatio > targetRatio) {
            drawH = targetWidth / imgRatio;
          } else {
            drawW = targetHeight * imgRatio;
          }
          const drawX = (targetWidth - drawW) / 2;
          const drawY = (targetHeight - drawH) / 2;
          
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
          
        } else {
          // Fill mode (crop, pan, zoom)
          const zoom = adjustment.zoom || 1;
          const xPercent = adjustment.x || 0;
          const yPercent = adjustment.y || 0;
          
          const imgRatio = img.width / img.height;
          let drawW = targetWidth;
          let drawH = targetHeight;
          
          // Cover logic
          if (imgRatio > targetRatio) {
             drawW = targetHeight * imgRatio;
          } else {
             drawH = targetWidth / imgRatio;
          }
          
          drawW *= zoom;
          drawH *= zoom;
          
          // Apply translations. Percentages map to total dimensions.
          const dx = (targetWidth - drawW) / 2 + (xPercent * targetWidth);
          const dy = (targetHeight - drawH) / 2 + (yPercent * targetHeight);
          
          ctx.drawImage(img, dx, dy, drawW, drawH);
        }
        
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      } catch (err) {
        console.error(err);
        resolve(imageUrl); // Fallback
      }
    };
    
    img.onerror = () => {
      resolve(imageUrl); // Fallback
    };
  });
};
