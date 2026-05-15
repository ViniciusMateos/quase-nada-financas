import { FastifyReply, FastifyRequest } from "fastify";
import { AuthService } from "./auth.service.js";

interface RegisterBody { email: string; password: string }
interface LoginBody { email: string; password: string; deviceInfo?: string }
interface RefreshBody { refreshToken: string }

export class AuthController {
  private readonly service = new AuthService();

  register = async (req: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) => {
    const result = await this.service.register(req.body.email, req.body.password);
    return reply.status(201).send(result);
  };

  login = async (req: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
    const result = await this.service.login(
      req.body.email,
      req.body.password,
      req.body.deviceInfo ?? req.headers["user-agent"]
    );
    return reply.send(result);
  };

  refresh = async (req: FastifyRequest<{ Body: RefreshBody }>, reply: FastifyReply) => {
    const result = await this.service.refresh(req.body.refreshToken);
    return reply.send(result);
  };

  logout = async (req: FastifyRequest<{ Body: RefreshBody }>, reply: FastifyReply) => {
    await this.service.logout(req.body.refreshToken);
    return reply.status(204).send();
  };

  me = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = await this.service.getMe(req.userId);
    return reply.send(user);
  };

  biometricChallenge = async (req: FastifyRequest, reply: FastifyReply) => {
    const token = await this.service.createBiometricChallenge(req.userId);
    return reply.send({ biometricToken: token, expiresInSeconds: 60 });
  };
}
