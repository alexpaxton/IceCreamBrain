export interface Compound {
  id: string;
  name: string;
  aliases: string[];
  pubchem_cid: number | null;
  flavor_smell: string;
  solubility: {
    water: string;
    alcohol: string;
    fat_logp: string;
  };
  temp_notes: string;
  sources: string[];
}

export interface IngredientCompound {
  compound_id: string;
  percentage: string | null;
  notes: string | null;
}

export interface Ingredient {
  id: string;
  name: string;
  scientific_name: string | null;
  variety: string | null;
  gcms_summary: string;
  compounds: IngredientCompound[];
  warnings: string | null;
  sources: string[];
}
