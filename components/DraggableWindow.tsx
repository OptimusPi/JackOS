/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useRef, useEffect } from 'react';
import { X, Minus, Square, Grip } from 'lucide-react';

interface DraggableWindowProps {
  id: string;
  title: string;
  icon?: React.ElementType;
  onClose: () => void;
  children: React.ReactNode;
  initialPos?: { x: number; y: number };
  initialSize?: { width: number; height: number };
  zIndex: number;
  onFocus?: () => void;
  isActive?: boolean;
}

export const DraggableWindow: React.FC<DraggableWindowProps> = ({
  title,
  icon: Icon,
  onClose,
  children,
  initialPos = { x: 50, y: 50 },
  initialSize = { width: 640, height: 480 },
  zIndex,
  onFocus,
  isActive = false,
}) => {
  const [pos, setPos] = useState(initialPos);
  const [size, setSize] = useState(initialSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const preMaximizeState = useRef({ pos, size });

  const dragStartPos = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  const handleHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target instanceof Element && e.target.closest('button')) return;

    if (onFocus) onFocus();
    if (isMaximized) return;

    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };
  };

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    if (onFocus) onFocus();
    setIsResizing(true);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    };
  };

  const toggleMaximize = () => {
    if (isMaximized) {
      setPos(preMaximizeState.current.pos);
      setSize(preMaximizeState.current.size);
    } else {
      preMaximizeState.current = { pos, size };
      setPos({ x: 0, y: 0 });
    }
    setIsMaximized(!isMaximized);
    if (onFocus) onFocus();
  };

  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (!isDragging && !isResizing) return;
      e.preventDefault();

      if (isDragging) {
        setPos({
          x: e.clientX - dragStartPos.current.x,
          y: e.clientY - dragStartPos.current.y,
        });
      }
      if (isResizing) {
        setSize({
          width: Math.max(320, resizeStart.current.width + (e.clientX - resizeStart.current.x)),
          height: Math.max(220, resizeStart.current.height + (e.clientY - resizeStart.current.y)),
        });
      }
    };

    const handleGlobalPointerUp = () => {
      if (isDragging || isResizing) {
        setIsDragging(false);
        setIsResizing(false);
      }
    };

    if (isDragging || isResizing) {
      window.addEventListener('pointermove', handleGlobalPointerMove, { passive: false });
      window.addEventListener('pointerup', handleGlobalPointerUp);
      window.addEventListener('pointercancel', handleGlobalPointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [isDragging, isResizing]);

  return (
    <div
      ref={windowRef}
      style={
        !isMaximized
          ? {
              left: pos.x,
              top: pos.y,
              width: size.width,
              height: size.height,
              zIndex,
            }
          : { zIndex }
      }
      className={`absolute flex flex-col rounded-[10px] border-[3px] ${
        isActive ? 'border-[#b9c2d2] border-b-[#6f7987]' : 'border-[#5a6c70] border-b-[#3b4a4d]'
      } bg-[#223033] shadow-[0_8px_0_rgba(0,0,0,0.55),0_16px_32px_rgba(0,0,0,0.55)] overflow-hidden ${
        isMaximized ? 'inset-0 rounded-none m-0 h-full w-full' : ''
      } transition-[border-color] duration-100 touch-none`}
      onPointerDown={() => {
        if (onFocus) onFocus();
      }}
    >
      {/* Balatro Beveled Titlebar */}
      <div
        onDoubleClick={toggleMaximize}
        onPointerDown={handleHeaderPointerDown}
        className={`px-3 py-1.5 flex items-center justify-between select-none touch-none border-b-2 border-[#162022] ${
          isActive ? 'bg-[#36494d]' : 'bg-[#28383b]'
        } ${!isMaximized ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        <div className="flex items-center gap-2 text-white pointer-events-none uppercase tracking-wider text-[16px]">
          {Icon && (
            <span className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-[#fe5f55] border-b-2 border-[#b8352e] text-white">
              <Icon size={12} />
            </span>
          )}
          <span className="[text-shadow:1px_1px_0_rgba(0,0,0,0.9)]">{title}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleMaximize}
            aria-label="Toggle maximize window"
            className="flex h-6 w-6 items-center justify-center rounded-[5px] bg-[#009dff] border-b-2 border-[#0068b8] text-white hover:brightness-90 active:translate-y-[1px] cursor-pointer"
          >
            {isMaximized ? <Minus size={12} /> : <Square size={10} />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Close window"
            className="flex h-6 w-6 items-center justify-center rounded-[5px] bg-[#fe5f55] border-b-2 border-[#b8352e] text-white hover:brightness-90 active:translate-y-[1px] cursor-pointer"
          >
            <X size={13} strokeWidth={2.8} />
          </button>
        </div>
      </div>

      {/* Window Content */}
      <div className="flex-1 overflow-hidden relative bg-[#182426]">
        {children}
        {!isActive && <div className="absolute inset-0 bg-transparent" />}
      </div>

      {/* Resize Handle */}
      {!isMaximized && (
        <div
          className="absolute bottom-0 right-0 w-7 h-7 cursor-nwse-resize flex items-center justify-center z-20 text-[#b9c2d2]/70 hover:text-[#f5b841] touch-none"
          onPointerDown={handleResizePointerDown}
        >
          <Grip size={14} className="-rotate-45 translate-x-1 translate-y-1" />
        </div>
      )}
    </div>
  );
};