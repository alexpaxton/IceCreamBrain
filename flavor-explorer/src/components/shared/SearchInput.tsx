import type { ChangeEvent } from 'react';
import styled from 'styled-components';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function SearchInput({ value, onChange }: Props) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
  }

  return <Input type="text" value={value} onChange={handleChange} placeholder="Search ingredients…" />;
}

const Input = styled.input`
  width: 100%;
  padding: 6px 8px;
  font-family: inherit;
  font-size: 13px;
  border: 1px solid #000;
  outline: none;
  background: #fff;
  color: #000;

  &::placeholder {
    color: #999;
  }

  &:focus {
    outline: 2px solid #000;
    outline-offset: -2px;
  }
`;
