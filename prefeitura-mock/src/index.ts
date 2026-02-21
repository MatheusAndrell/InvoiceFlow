import express from 'express';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const SUCCESS_RATE = parseFloat(process.env.SUCCESS_RATE || '0.8');

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/nfse/emitir', async (req, res) => {
  const { saleId } = req.body;
  
  console.log(`Received NFS-e request for sale: ${saleId}`);

  // Simulate 2-second government processing delay
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const isSuccess = Math.random() < SUCCESS_RATE;

  if (isSuccess) {
    const protocol = `NFSE-${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`;
    console.log(`Success: issued protocol ${protocol} for sale ${saleId}`);
    res.json({ success: true, protocol });
  } else {
    const errors = [
      'CPF/CNPJ do tomador inválido',
      'Código de serviço não encontrado',
      'Valor de serviço inválido',
      'Certificado digital vencido',
    ];
    const errorMsg = errors[Math.floor(Math.random() * errors.length)];
    console.log(`Error: ${errorMsg} for sale ${saleId}`);
    res.status(422).json({ success: false, error: errorMsg });
  }
});

app.listen(PORT, () => {
  console.log(`Prefeitura Mock running on port ${PORT} (success rate: ${SUCCESS_RATE * 100}%)`);
});
