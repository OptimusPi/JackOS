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

const MOBILE_BREAKPOINT = 768;
const DOCK_RESERVE_PX = 96;
const EDGE_MARGIN_PX = 8;

function clampWindowGeometry(
  rawPos: { x: number; y: number },
  rawSize: { width: number; height: number }
): { pos: { x: number; y: number }; size: { width: number; height: number } } {
  if (typeof window === 'undefined') {
    return { pos: rawPos, size: rawSize };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isMobile = vw < MOBILE_BREAKPOINT;

  const maxW = Math.max(280, vw - EDGE_MARGIN_PX * 2);
  const maxH = Math.max(240, vh - DOCK_RESERVE_PX - EDGE_MARGIN_PX);

  const width = isMobile ? maxW : Math.min(rawSize.width, maxW);
  const height = isMobile ? maxH : Math.min(rawSize.height, maxH);

  const maxX = Math.max(EDGE_MARGIN_PX, vw - width - EDGE_MARGIN_PX);
  const maxY = Math.max(EDGE_MARGIN_PX, vh - height - DOCK_RESERVE_PX);

  const x = isMobile ? EDGE_MARGIN_PX : Math.min(Math.max(EDGE_MARGIN_PX, rawPos.x), maxX);
  const y = isMobile ? EDGE_MARGIN_PX : Math.min(Math.max(EDGE_MARGIN_PX, rawPos.y), maxY);

  return { pos: { x, y }, size: { width, height } };
}

export const DraggableWindow: React.FC<DraggableWindowProps> = ({
  title,
  icon: Icon,
  onClose,
  children,
  initialPos = { x: 24, y: 24 },
  initialSize = { width: 560, height: 480 },
  zIndex,
  onFocus,
  isActive = false,
}) => {
  const initialClamped = clampWindowGeometry(initialPos, initialSize);
  const [pos, setPos] = useState(initialClamped.pos);
  const [size, setSize] = useState(initialClamped.size);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const preMaximizeState = useRef({ pos: initialClamped.pos, size: initialClamped.size });

  const dragStartPos = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  // Re-clamp window cleanly whenever the viewport resizes or rotates
  useEffect(() => {
    const onResize = () => {
      setPos((prevPos) => clampWindowGeometry(prevPos, size).pos);
      setSize((prevSize) => clampWindowGeometry(pos, prevSize).size);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [pos, size]);

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
      const restored = clampWindowGeometry(
        preMaximizeState.current.pos,
        preMaximizeState.current.size
      );
      setPos(restored.pos);
      setSize(restored.size);
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

      const vw = window.innerWidth;
      const vh = window.innerHeight;

      if (isDragging) {
        const nextX = e.clientX - dragStartPos.current.x;
        const nextY = e.clientY - dragStartPos.current.y;
        const maxX = Math.max(EDGE_MARGIN_PX, vw - size.width - EDGE_MARGIN_PX);
        const maxY = Math.max(EDGE_MARGIN_PX, vh - 80);
        setPos({
          x: Math.min(Math.max(EDGE_MARGIN_PX, nextX), maxX),
          y: Math.min(Math.max(EDGE_MARGIN_PX, nextY), maxY),
        });
      }
      if (isResizing) {
        const maxW = Math.max(280, vw - pos.x - EDGE_MARGIN_PX);
        const maxH = Math.max(220, vh - pos.y - EDGE_MARGIN_PX);
        setSize({
          width: Math.min(maxW, Math.max(280, resizeStart.current.width + (e.clientX - resizeStart.current.x))),
          height: Math.min(maxH, Math.max(220, resizeStart.current.height + (e.clientY - resizeStart.current.y))),
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
  }, [isDragging, isResizing, pos.x, pos.y, size.width]);

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
              maxWidth: 'calc(100vw - 16px)',
              maxHeight: 'calc(100dvh - 88px)',
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
        className={`px-3 py-1.5 flex items-center justify-between gap-2 select-none touch-none border-b-2 border-[#162022] ${
          isActive ? 'bg-[#36494d]' : 'bg-[#28383b]'
        } ${!isMaximized ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0 text-white pointer-events-none uppercase tracking-wider text-[15px] sm:text-[16px]">
          {Icon && (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] bg-[#fe5f55] border-b-2 border-[#b8352e] text-white">
              <Icon size={12} />
            </span>
          )}
          <span className="truncate [text-shadow:1px_1px_0_rgba(0,0,0,0.9)]">{title}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={toggleMaximize}
            aria-label="Toggle maximize window"
            className="flex h-7 w-7 sm:h-6 sm:w-6 items-center justify-center rounded-[5px] bg-[#009dff] border-b-2 border-[#0068b8] text-white hover:brightness-90 active:translate-y-[1px] cursor-pointer"
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
            className="flex h-7 w-7 sm:h-6 sm:w-6 items-center justify-center rounded-[5px] bg-[#fe5f55] border-b-2 border-[#b8352e] text-white hover:brightness-90 active:translate-y-[1px] cursor-pointer"
          >
            <X size={13} strokeWidth={2.8} />
          </button>
        </div>
      </div>

      {/* Window Content */}
      <div className="flex-1 min-h-0 overflow-hidden relative bg-[#182426]">
        {children}
        {!isActive && <div className="absolute inset-0 bg-transparent" />}
      </div>

      {/* Resize Handle */}
      {!isMaximized && (
        <div
          className="hidden sm:flex absolute bottom-0 right-0 w-7 h-7 cursor-nwse-resize items-center justify-center z-20 text-[#b9c2d2]/70 hover:text-[#f5b841] touch-none"
          onPointerDown={handleResizePointerDown}
        >
          <Grip size={14} className="-rotate-45 translate-x-1 translate-y-1" />
        </div>
      )}
    </div>
  );
};