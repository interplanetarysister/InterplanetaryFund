import { useRef } from "react";

export default function ScrollableNav({ children }) {
  const gesture = useRef(null);
  const suppressClick = useRef(false);

  function begin(event) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    suppressClick.current = false;
    const nav = event.currentTarget;
    if (nav.scrollHeight <= nav.clientHeight) return;
    gesture.current = { pointer: event.pointerId, y: event.clientY, top: nav.scrollTop };
  }

  function move(event) {
    const state = gesture.current;
    if (state?.pointer !== event.pointerId) return;
    const nav = event.currentTarget;
    if (!(event.buttons & 1)) {
      finish(event);
      return;
    }
    const delta = event.clientY - state.y;
    if (!state.dragging && Math.abs(delta) < 6) return;
    if (!state.dragging) {
      state.dragging = true;
      suppressClick.current = true;
      nav.setPointerCapture(event.pointerId);
      nav.dataset.dragging = "";
    }
    event.preventDefault();
    nav.scrollTop = state.top - delta;
  }

  function finish(event) {
    if (gesture.current?.pointer !== event.pointerId) return;
    gesture.current = null;
    delete event.currentTarget.dataset.dragging;
  }

  return <nav aria-label="Main navigation" tabIndex={0}
    className="ifund-sidebar-nav flex min-h-0 flex-1 touch-pan-y flex-col gap-3 overflow-y-auto overscroll-contain px-2 pb-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    onPointerDown={begin} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}
    onPointerLeave={event => { if (!gesture.current?.dragging) finish(event); }}
    onLostPointerCapture={finish}
    onDragStart={event => event.preventDefault()}
    onClickCapture={event => {
      if (event.detail && suppressClick.current) {
        event.preventDefault();
        event.stopPropagation();
        suppressClick.current = false;
      }
    }}>
    {children}
  </nav>;
}
