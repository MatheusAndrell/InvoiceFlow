export function generateXml(sale: {
  id: string;
  amount: number;
  description: string;
  createdAt: Date;
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<NFSe>
  <InfNFSe>
    <Numero>${sale.id}</Numero>
    <DataEmissao>${sale.createdAt.toISOString()}</DataEmissao>
    <Servico>
      <Valores>
        <ValorServicos>${sale.amount.toFixed(2)}</ValorServicos>
      </Valores>
      <Discriminacao>${escapeXml(sale.description)}</Discriminacao>
    </Servico>
  </InfNFSe>
</NFSe>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
