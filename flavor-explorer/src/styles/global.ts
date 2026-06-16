import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html, body, #root {
    height: 100%;
    overflow: hidden;
  }

  body {
    font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace;
    font-size: 13px;
    line-height: 1.5;
    color: #000;
    background: #fff;
    -webkit-font-smoothing: antialiased;
  }

  a {
    color: #000;
    text-decoration: underline;
  }

  a:hover {
    opacity: 0.6;
  }

  table {
    border-collapse: collapse;
    width: 100%;
  }

  th, td {
    border: 1px solid #000;
    padding: 4px 8px;
    text-align: left;
    vertical-align: top;
  }

  th {
    font-weight: bold;
    background: #000;
    color: #fff;
  }
`;
