import type { ReactNode } from 'react';
import styled from 'styled-components';

interface Props {
  title: string;
  children: ReactNode;
  dimmed?: boolean;
  footer?: ReactNode;
}

/** Shared frame for every composer node: title bar + body + optional footer. */
export function NodeShell({ title, children, dimmed = false, footer }: Props) {
  return (
    <Shell $dimmed={dimmed}>
      <TitleBar>{title}</TitleBar>
      <Body>{children}</Body>
      {footer && <Footer>{footer}</Footer>}
    </Shell>
  );
}

const Shell = styled.div<{ $dimmed: boolean }>`
  background: #fff;
  border: 1px solid #000;
  min-width: 220px;
  opacity: ${(p) => (p.$dimmed ? 0.5 : 1)};
`;

const TitleBar = styled.div`
  font-size: 11px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 6px 8px;
  border-bottom: 1px solid #000;
  background: #eee;
`;

const Body = styled.div`
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Footer = styled.div`
  padding: 4px 8px;
  border-top: 1px solid #000;
  font-size: 11px;
  opacity: 0.6;
`;

// ---------------------------------------------------------------------------
// Shared form controls. Every interactive input inside a node must carry
// the `nodrag` class so react-flow doesn't intercept pointer events meant
// for the input. .attrs merges it in even if a caller passes its own
// className.
// ---------------------------------------------------------------------------

function withNodrag(className?: string): string {
  return className ? `nodrag ${className}` : 'nodrag';
}

export const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

export const Label = styled.label`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.7;
  white-space: nowrap;
`;

export const Input = styled.input.attrs<{ className?: string }>((p) => ({
  className: withNodrag(p.className),
}))`
  font-family: inherit;
  font-size: 12px;
  padding: 3px 6px;
  border: 1px solid #000;
  background: #fff;
  color: #000;
  outline: none;
  width: 100%;
  min-width: 0;

  &:focus {
    outline: 2px solid #000;
    outline-offset: -2px;
  }

  &::placeholder {
    color: #999;
  }
`;

export const Select = styled.select.attrs<{ className?: string }>((p) => ({
  className: withNodrag(p.className),
}))`
  font-family: inherit;
  font-size: 12px;
  padding: 3px 6px;
  border: 1px solid #000;
  background: #fff;
  color: #000;
  outline: none;
  width: 100%;
  min-width: 0;

  &:focus {
    outline: 2px solid #000;
    outline-offset: -2px;
  }
`;

export const SmallButton = styled.button.attrs<{ className?: string }>((p) => ({
  className: withNodrag(p.className),
}))`
  font-family: inherit;
  font-size: 11px;
  padding: 3px 8px;
  border: 1px solid #000;
  background: #fff;
  color: #000;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: #000;
    color: #fff;
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;

    &:hover {
      background: #fff;
      color: #000;
    }
  }
`;

export const Warning = styled.div`
  font-size: 11px;
  border: 1px solid #000;
  background: #eee;
  padding: 4px 6px;
`;
