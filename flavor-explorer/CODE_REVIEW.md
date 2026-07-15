# Code standards

### General

- Constants use screaming snake case (ex: APPLE_PIE)
- Type definitions use pascal case (ex: ApplePie)
- No default exports unless required by a library or framework
- Helper functions should be present tense and  follow the "verb noun" naming scheme. For example a function that calculates coordinates for chart elements should be called "calculateChartElementCoords". Or a data transformation function could be "getCoordsFromMaps"

### .tsx files

- Ordering of sections:
  1. Imports
  2. Local type definitions (starting with component props)
  3. Component definition
  4. Local helper functions
  5. Styled components styles
- Only 1 component defined per file to keep files concise and readable
- Do not prop drill. Props should not be passed beyond parent -> child. Use contexts when props need to be passed more than 1 level deep.
- Event handlers should always start with "handle" (ex: handleClick, handleExpand, handleCollapse)
- Naming props:
  1. Event callbacks should always start with "on" (ex: onClick, onExpand, onCollapse)
  2. boolean type props should start with "is" (ex: isVisible, isExpanded)
- No inline functions defined in the return body of components
- No ternary operators defined in the return body of functions
- No nested ternary operators. Use multiple if statements or a switch

### Centralization

- Components should be organized by their primary view. (ex: DetailView -> components/details/DetailView)
- Components that are used in more than 1 page level view belong in "src/components/shared". This includes navigational components.
- Constants, Types, and any helper functions should be defined in src/lib. One file for constants, one file for types, and one file per helper function