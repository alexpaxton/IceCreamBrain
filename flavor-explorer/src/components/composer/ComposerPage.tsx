import styled from 'styled-components';

export function ComposerPage() {
  return (
    <Layout>
      <Empty>Composer coming soon.</Empty>
    </Layout>
  );
}

const Layout = styled.div`
  display: flex;
  height: 100%;
  overflow: hidden;
`;

const Empty = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  opacity: 0.3;
  font-size: 13px;
`;
