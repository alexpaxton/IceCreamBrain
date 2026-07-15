import { useEffect, useRef, useState } from 'react';
import { createPopper, type Instance } from '@popperjs/core';
import styled from 'styled-components';
import type { Compound } from '../../lib/types';

interface Props {
  compound: Compound;
}

export function CompoundPopover({ compound }: Props) {
  const [visible, setVisible] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const popperRef = useRef<Instance | null>(null);

  useEffect(() => {
    if (!visible || !triggerRef.current || !bubbleRef.current) return;

    popperRef.current = createPopper(triggerRef.current, bubbleRef.current, {
      placement: 'top',
      modifiers: [{ name: 'offset', options: { offset: [0, 6] } }],
    });

    return () => {
      popperRef.current?.destroy();
      popperRef.current = null;
    };
  }, [visible]);

  function handleMouseEnter() {
    setVisible(true);
  }

  function handleMouseLeave() {
    setVisible(false);
  }

  return (
    <>
      <Trigger ref={triggerRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        {compound.name}
      </Trigger>
      {visible && <Bubble ref={bubbleRef}>{compound.flavor_smell}</Bubble>}
    </>
  );
}

const Trigger = styled.span`
  cursor: default;
  &:hover {
    border-bottom: 1px dotted #000;
  }
`;

const Bubble = styled.div`
  border: 1px solid #000;
  border-bottom-width: 4px;
  background: #fff;
  padding: 8px 10px;
  font-size: 11px;
  line-height: 1.4;
  max-width: 220px;
  z-index: 10;
`;
