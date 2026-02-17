import React, { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';

export default function SwipeableCard({ children, onSwipeLeft, onSwipeRight, className = '' }) {
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState(0);
  const cardRef = useRef(null);

  const minSwipeDistance = 50;

  const handleTouchStart = (e) => {
    setTouchEnd(0);
    setTouchStart(e.targetTouches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const currentTouch = e.targetTouches[0].clientX;
    const diff = currentTouch - touchStart;
    setOffset(diff);
    setTouchEnd(currentTouch);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && onSwipeLeft) {
      onSwipeLeft();
    }
    if (isRightSwipe && onSwipeRight) {
      onSwipeRight();
    }

    // Reset
    setTimeout(() => setOffset(0), 200);
  };

  return (
    <div className="relative overflow-hidden">
      {/* Swipe actions background */}
      {offset !== 0 && (
        <div className={`absolute inset-0 flex items-center justify-${offset > 0 ? 'start' : 'end'} px-6 ${
          offset > 0 ? 'bg-emerald-100 dark:bg-emerald-950' : 'bg-red-100 dark:bg-red-950'
        }`}>
          <span className={`text-sm font-medium ${
            offset > 0 ? 'text-emerald-700' : 'text-red-700'
          }`}>
            {offset > 0 ? (onSwipeRight ? '→' : '') : (onSwipeLeft ? '←' : '')}
          </span>
        </div>
      )}

      <Card
        ref={cardRef}
        className={`${className} transition-transform touch-pan-y`}
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </Card>
    </div>
  );
}