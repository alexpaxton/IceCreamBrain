import styled from 'styled-components';
import { useComposer } from './ComposerContext';

export function RecipePanel() {
  const { derived } = useComposer();
  const hasMarkdown = derived.markdown.trim().length > 0;
  const showIssuesBanner = derived.recipe !== null && derived.issues.length > 0;

  async function handleCopy() {
    if (!hasMarkdown) return;
    try {
      await navigator.clipboard.writeText(derived.markdown);
    } catch {
      // Clipboard access denied or unavailable — ignore.
    }
  }

  function handleDownload() {
    if (!hasMarkdown) return;
    const name = derived.recipe?.name?.trim() || 'recipe';
    const filename = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'recipe'}.md`;
    const blob = new Blob([derived.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Panel>
      <Header>
        <Title>Recipe</Title>
        <Actions>
          <ActionButton onClick={handleCopy} disabled={!hasMarkdown}>
            Copy
          </ActionButton>
          <ActionButton onClick={handleDownload} disabled={!hasMarkdown}>
            Download
          </ActionButton>
        </Actions>
      </Header>
      <Body>
        {hasMarkdown ? (
          <>
            {showIssuesBanner && (
              <IssuesBanner>
                {derived.issues.map((issue, i) => (
                  <div key={i}>{issue.message}</div>
                ))}
              </IssuesBanner>
            )}
            <Markdown>{derived.markdown}</Markdown>
          </>
        ) : (
          <Empty>
            <div>recipe incomplete</div>
            {derived.issues.map((issue, i) => (
              <div key={i}>{issue.message}</div>
            ))}
          </Empty>
        )}
      </Body>
    </Panel>
  );
}

const Panel = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #000;
`;

const Title = styled.div`
  font-size: 11px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

const Actions = styled.div`
  display: flex;
  gap: 6px;
`;

const ActionButton = styled.button`
  font-family: inherit;
  font-size: 11px;
  padding: 4px 10px;
  border: 1px solid #000;
  background: #fff;
  color: #000;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: #000;
    color: #fff;
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;
  }
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px;
`;

const Markdown = styled.pre`
  font-family: inherit;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  padding: 0;
  overflow: auto;
`;

const IssuesBanner = styled.div`
  font-size: 11px;
  border: 1px solid #000;
  background: #eee;
  padding: 4px 6px;
  margin-bottom: 10px;
`;

const Empty = styled.div`
  opacity: 0.5;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;
