import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * useDraggableScroll
 * 
 * Permite que um container seja arrastado horizontalmente com o mouse (estilo Trello).
 * 
 * @returns { ref, onMouseDown }
 */
export function useDraggableScroll() {
  const ref = useRef<HTMLElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Evita disparar se o clique for em botões, inputs, links ou no próprio card draggable
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button, input, a, [draggable="true"], .kanban-card');
    
    if (isInteractive) return;

    const container = ref.current;
    if (!container) return;

    setIsDragging(true);
    // e.pageX é a posição absoluta do mouse, container.offsetLeft a posição do container na página
    setStartX(e.pageX - container.offsetLeft);
    setScrollLeft(container.scrollLeft);
    
    // Adiciona feedback visual imediato
    container.style.cursor = 'grabbing';
    container.style.userSelect = 'none';
  }, []);

  const onMouseUp = useCallback(() => {
    setIsDragging(false);
    const container = ref.current;
    if (container) {
      container.style.cursor = '';
      container.style.userSelect = '';
    }
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const container = ref.current;
    if (!container) return;

    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    // Multiplicador 1.5 para um arrasto mais ágil, ou 1 para 1:1 exato
    const walk = (x - startX) * 1.5; 
    container.scrollLeft = scrollLeft - walk;
  }, [isDragging, startX, scrollLeft]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    } else {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, onMouseMove, onMouseUp]);

  return { ref, onMouseDown };
}
