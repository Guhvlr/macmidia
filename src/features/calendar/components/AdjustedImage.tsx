import React, { useState, useEffect } from 'react';
import { applyImageAdjustment } from '@/lib/imageProcessor';
import type { CalendarTask } from '@/contexts/app-types';

interface AdjustedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  url: string;
  task: CalendarTask;
}

export function AdjustedImage({ url, task, className, ...props }: AdjustedImageProps) {
  const [renderedUrl, setRenderedUrl] = useState<string>(url);

  useEffect(() => {
    let isMounted = true;
    
    const renderAdjustment = async () => {
      if (task?.image_adjustments && task.image_adjustments[url]) {
         const typeStr = task.contentType?.toLowerCase() || '';
         let formatToUse = 'feed_vertical';
         let ratio = 4/5;
         
         if (typeStr.includes('stor')) { formatToUse = 'story'; ratio = 9/16; }
         else if (typeStr.includes('reel') || typeStr.includes('vídeo')) { formatToUse = 'reels'; ratio = 9/16; }
         else if (typeStr.includes('quadrado')) { formatToUse = 'feed_square'; ratio = 1; }
         else if (typeStr.includes('carrossel')) { formatToUse = 'carousel'; ratio = 4/5; }
         
         const adj = task.image_adjustments[url][formatToUse];
         if (adj) {
            const result = await applyImageAdjustment(url, adj, ratio);
            if (isMounted) {
              setRenderedUrl(result);
            }
            return;
         }
      }
      
      // Fallback to original url if no adjustments found
      if (isMounted) {
        setRenderedUrl(url);
      }
    };

    renderAdjustment();

    return () => {
      isMounted = false;
    };
  }, [url, task?.image_adjustments, task?.contentType]);

  return <img src={renderedUrl} className={className} {...props} />;
}
