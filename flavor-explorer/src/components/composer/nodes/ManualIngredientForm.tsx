import { useState, type ChangeEvent, type FormEvent } from 'react';
import styled from 'styled-components';
import type { IngredientMacros, MacroKey } from '../../../lib/composer/types';
import { useComposer } from '../ComposerContext';
import { Row, Label, Input, SmallButton, Warning } from './NodeShell';

interface Props {
  initialName?: string;
  onCreated: (ingredientId: string) => void;
  onCancel: () => void;
}

const MACRO_FIELDS: { key: MacroKey; label: string }[] = [
  { key: 'water', label: 'Water' },
  { key: 'fat', label: 'Fat' },
  { key: 'sugars', label: 'Sugars' },
  { key: 'starch', label: 'Starch' },
  { key: 'protein', label: 'Protein' },
  { key: 'otherSolids', label: 'Other' },
];

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function ManualIngredientForm({ initialName, onCreated, onCancel }: Props) {
  const { db, addUserIngredient } = useComposer();
  const [name, setName] = useState(initialName ?? '');
  const [macros, setMacros] = useState<Record<MacroKey, number>>({
    water: 0,
    fat: 0,
    sugars: 0,
    starch: 0,
    protein: 0,
    otherSolids: 0,
  });
  const [source, setSource] = useState('');
  const [isDairy, setIsDairy] = useState(false);
  const [isEggYolk, setIsEggYolk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleMacroChange(key: MacroKey, e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.valueAsNumber;
    setMacros((prev) => ({ ...prev, [key]: Number.isFinite(value) ? value : 0 }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }
    const sum = MACRO_FIELDS.reduce((acc, f) => acc + macros[f.key], 0);
    if (Math.abs(sum - 100) > 1) {
      setError(`Macros sum to ${sum.toFixed(1)}%, must be ~100%.`);
      return;
    }

    let id = slugify(trimmedName);
    if (!id) id = 'ingredient';
    if (db.byId.has(id)) {
      let suffix = 2;
      while (db.byId.has(`${id}-${suffix}`)) suffix += 1;
      id = `${id}-${suffix}`;
    }

    const ingredient: IngredientMacros = {
      id,
      name: trimmedName,
      water: macros.water,
      fat: macros.fat,
      sugars: macros.sugars,
      starch: macros.starch,
      protein: macros.protein,
      otherSolids: macros.otherSolids,
      source: source.trim() || undefined,
      isDairy: isDairy || undefined,
      isEggYolk: isEggYolk || undefined,
      userAdded: true,
    };

    addUserIngredient(ingredient);
    onCreated(id);
  }

  return (
    <Form onSubmit={handleSubmit}>
      <Row>
        <Label htmlFor="new-ingredient-name">Name</Label>
        <Input
          id="new-ingredient-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </Row>

      <MacroGrid>
        {MACRO_FIELDS.map((f) => (
          <Row key={f.key}>
            <Label htmlFor={`new-ingredient-${f.key}`}>{f.label}</Label>
            <Input
              id={`new-ingredient-${f.key}`}
              type="number"
              value={macros[f.key]}
              onChange={(e) => handleMacroChange(f.key, e)}
            />
          </Row>
        ))}
      </MacroGrid>

      <Row>
        <Label htmlFor="new-ingredient-source">Source</Label>
        <Input
          id="new-ingredient-source"
          type="text"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="optional"
        />
      </Row>

      <Row>
        <CheckboxLabel>
          <input
            className="nodrag"
            type="checkbox"
            checked={isDairy}
            onChange={(e) => setIsDairy(e.target.checked)}
          />
          Dairy
        </CheckboxLabel>
        <CheckboxLabel>
          <input
            className="nodrag"
            type="checkbox"
            checked={isEggYolk}
            onChange={(e) => setIsEggYolk(e.target.checked)}
          />
          Egg yolk
        </CheckboxLabel>
      </Row>

      {error && <Warning>{error}</Warning>}

      <Row>
        <SmallButton type="submit">Save ingredient</SmallButton>
        <SmallButton type="button" onClick={onCancel}>
          Cancel
        </SmallButton>
      </Row>
    </Form>
  );
}

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid #000;
  padding-top: 6px;
  margin-top: 4px;
`;

const MacroGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const CheckboxLabel = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
`;
