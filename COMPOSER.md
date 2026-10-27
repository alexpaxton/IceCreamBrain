# Composer

Composer is a tool for developing ice cream recipes. It allows the user to adjust input values at different points in the process to create a recipe that passes different checks. 

### Where

Composer lives within the flavor explorer app at /flavor-explorer/composer. It will only be a single page.

### Overview

The page will feature 2 panels side by side. The left panel (aka the "Lab" view) offers a node based UI for choosing the different components for the recipe. The right side (aka the "Recipe" view) will show the recipe draft in markdown format.

The Lab view will have some nodes visible by default:

- Style (user chooses from:)
  - Philadelphia
  - Custard
  - Sherbet
  - Sorbet
- Sweetener
  - User can add sweeteners from the list (See Calculate PAC skill) and a %
  - ex: 75% sucrose 20% allulose 5% honey
- Base (only visible if Style =/= Sorbet)
  - Dairy
  - Users can add their own and save them
- Serving temperature
  - User specifies a temperature in F or C
- PAC check
  - Looks at the total ingredients in the recipe, the serving temperature, and returns a PAC score
- Macro balance check
  - Totals macros for the recipe and compares against standards for the selected style
  - Appears as a 3 column table with columns "Macro", "Standard", and "%"
  - Values should be listed as %s that total to 100%
  - Macros that diverge from the standard are highlighted
- Recipe output quantity
  - Allows user to specify a quantity in grams
  - The recipe panel will scale everything to the quantity

In addition to these nodes, users should be able to add flavoring nodes (for specifying flavoring ingredients) and ingredient nodes (for ingredients that are not the base but contain enough mass to affect the macro balance, such as fruit)

Whenever a value is changed in the node tree, everything should recompute. This way the user can see the effect of their changes.

The feature is meant to be used as a playground. Only the main nodes generate a recipe, but users can have other nodes in the canvas to try out ideas. For example, if the user wanted to create a new base they could add ingredient nodes, connect them all to a 2nd ingredient macros node, then have it determine whether the ingredients and %s would satisfy the requirements for the style.

All quantities displayed in nodes should be treated as proportions. The exception is the output quantity node. 

### Technical

I want to use react-flow for the node based ui. I don't need zoom, but nodes can be dragged around. Most nodes have hardcoded connections, but some (such as flavoring and ingredient nodes) must be connected to the main flow to be part of the calculation

Since the application has no backend, everything should live in state and local storage. This way the user won't lose their work on refresh or navigating away.

The ingredient macros skill has a reference table for some ingredients. There should be a json file in the application with ingredient macros in it. If the user wants to add an ingredient that isn't in the json file, run the skill to find the macros on the web. We can use the anthropic API for this.

Users should be able to connect their anthropic account, or at least provide an API key so that any calls to the anthropic API uses the users credentials

### UX and style

The application's UI should imitate the look and feel of the flavor explorer application. Minimal, black and white, technical.