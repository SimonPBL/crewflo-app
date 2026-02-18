import React, { useState, useRef, useEffect } from 'react';
import { Trash2, ChevronRight } from 'lucide-react';

interface SwipeToConfirmButtonProps {
  onConfirm: () => void;
  label?: string;
  className?: string;
}

export const SwipeToConfirmButton: React.FC<SwipeToConfirmButtonProps> = ({ 
  onConfirm, 
  label = "Glisser pour supprimer",
  className = ""
}) => {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const dragXRef = useRef(0);
  const onConfirmRef = useRef(onConfirm);

  // Mettre à jour la ref si la prop change pour éviter les fermetures obsolètes (stale closures)
  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);

  const HANDLE_WIDTH = 40; 

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    // N'autoriser que le clic gauche ou le tactile
    if ('button' in e && e.button !== 0) return;
    
    e.stopPropagation(); 
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const container = containerRef.current;
    if (!container) return;

    const handleMove = (clientX: number) => {
        if (isConfirmed) return;
        
        const rect = container.getBoundingClientRect();
        // Position relative au conteneur, moins la moitié de la poignée pour centrer
        const x = clientX - rect.left - (HANDLE_WIDTH / 2);
        const containerWidth = container.clientWidth;
        const maxDrag = containerWidth - HANDLE_WIDTH;
        
        // Limiter le déplacement entre 0 et maxDrag
        const newX = Math.max(0, Math.min(x, maxDrag));
        
        setDragX(newX);
        dragXRef.current = newX;
    };

    const handleEnd = () => {
        setIsDragging(false);
        
        const containerWidth = container.clientWidth;
        const maxDrag = containerWidth - HANDLE_WIDTH;
        const threshold = maxDrag * 0.75; 

        // Si on a glissé assez loin (75%)
        if (dragXRef.current >= threshold) {
            setIsConfirmed(true);
            setDragX(maxDrag); // Snap visuel à la fin
            
            // Déclencher l'action après une petite animation
            setTimeout(() => {
                if (onConfirmRef.current) onConfirmRef.current();
            }, 200);
        } else {
            // Retour au début
            setDragX(0);
            dragXRef.current = 0;
        }
    };

    const onMouseMove = (e: MouseEvent) => {
        e.preventDefault();
        handleMove(e.clientX);
    };
    
    const onTouchMove = (e: TouchEvent) => {
        // Empêcher le scroll pendant le swipe
        if (e.cancelable) e.preventDefault();
        handleMove(e.touches[0].clientX);
    };

    const onMouseUp = () => handleEnd();
    const onTouchEnd = () => handleEnd();

    // Attacher les écouteurs à window pour gérer le glissement hors du bouton
    window.addEventListener('mousemove', onMouseMove, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchend', onTouchEnd);

    return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging, isConfirmed]);

  return (
    <div 
      ref={containerRef}
      className={`relative h-10 w-full max-w-[260px] bg-slate-100 rounded-full overflow-hidden border border-slate-200 select-none touch-none ${className} ${isConfirmed ? 'bg-red-50 border-red-100' : ''}`}
      style={{ touchAction: 'none' }}
    >
      <div className={`absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-wider transition-opacity duration-300 pointer-events-none ${isDragging ? 'opacity-40' : 'opacity-100'} ${isConfirmed ? 'text-red-600' : 'text-slate-400'}`}>
        {isConfirmed ? 'Confirmé' : label}
      </div>

      <div 
        className="absolute inset-y-0 left-0 bg-red-500/10 transition-none" 
        style={{ width: dragX + HANDLE_WIDTH/2 }} 
      />

      <div 
        className={`absolute top-0 bottom-0 w-10 bg-white rounded-full shadow-sm border border-slate-200 flex items-center justify-center cursor-grab active:cursor-grabbing z-10 transition-transform duration-75 ${isDragging ? 'scale-105 border-red-300' : ''}`}
        style={{ 
            left: dragX, 
            transition: isDragging ? 'none' : 'left 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' 
        }}
        onMouseDown={handleStart}
        onTouchStart={handleStart}
      >
        {isConfirmed ? (
           <Trash2 className="w-4 h-4 text-red-600 animate-pulse" />
        ) : dragX > 5 ? (
           <Trash2 className={`w-4 h-4 transition-colors ${dragX > 50 ? 'text-red-500' : 'text-slate-300'}`} />
        ) : (
           <ChevronRight className="w-5 h-5 text-slate-400 ml-0.5" />
        )}
      </div>
    </div>
  );
};