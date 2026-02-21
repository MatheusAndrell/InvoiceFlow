import { Router } from 'express';
import { uploadCertificate, getCertificates } from '../controllers/certificate.controller';
import { authMiddleware } from '../middlewares/auth';
import { upload } from '../middlewares/upload';

const router = Router();

router.use(authMiddleware);

router.post('/', upload.single('certificate'), uploadCertificate);
router.get('/', getCertificates);

export default router;
