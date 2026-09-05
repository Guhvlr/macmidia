import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Hook for mobile swipe navigation between kanban columns.
 * Priority: scroll > swipe > drag (swipe only on background, not on cards)
 */
export function useMobileSwipe(totalColumns: number) {
  const [activeColumn, setActiveColumn] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);
  const isScrolling = useRef(false);

  const SWIPE_THRESHOLD = 50;

  const goToColumn = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, totalColumns - 1));
    setActiveColumn(clamped);
  }, [totalColumns]);

  const goNext = useCallback(() => {
    goToColumn(activeColumn + 1);
  }, [activeColumn, goToColumn]);

  const goPrev = useCallback(() => {
    goToColumn(activeColumn - 1);
  }, [activeColumn, goToColumn]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Don't start swipe if touching a card or interactive element
    const target = e.target as HTMLElement;
    if (target.closest('.kanban-card, button, input, textarea, a, [data-no-dnd="true"]')) {
      isSwiping.current = false;
      return;
    }
    
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
    isScrolling.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isScrolling.current) return;

    const diffX = e.touches[0].clientX - touchStartX.current;
    const diffY = e.touches[0].clientY - touchStartY.current;

    // If vertical movement is dominant, it's a scroll — don't interfere
    if (!isSwiping.current && Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 10) {
      isScrolling.current = true;
      return;
    }

    // If horizontal movement is dominant, it's a swipe
    if (Math.abs(diffX) > 15) {
      isSwiping.current = true;
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isSwiping.current || isScrolling.current) return;

    const diffX = e.changedTouches[0].clientX - touchStartX.current;

    if (Math.abs(diffX) > SWIPE_THRESHOLD) {
      if (diffX < 0) {
        goNext();
      } else {
        goPrev();
      }
    }

    isSwiping.current = false;
    isScrolling.current = false;
  }, [goNext, goPrev]);

  // Clamp active column if total columns change
  useEffect(() => {
    if (activeColumn >= totalColumns) {
      setActiveColumn(Math.max(0, totalColumns - 1));
    }
  }, [totalColumns, activeColumn]);

  return {
    activeColumn,
    setActiveColumn: goToColumn,
    containerRef,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}
