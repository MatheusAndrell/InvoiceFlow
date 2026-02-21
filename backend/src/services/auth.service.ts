import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class AuthService {
  async login(email: string, password: string): Promise<{ token: string; userId: string }> {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new Error('Invalid credentials');
    }

    const secret = process.env.JWT_SECRET as string;
    const token = jwt.sign({ userId: user.id }, secret, { expiresIn: '24h' });

    return { token, userId: user.id };
  }
}
