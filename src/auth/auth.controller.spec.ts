import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    register: jest.Mock;
    login: jest.Mock;
    forgotPassword: jest.Mock;
    resetPassword: jest.Mock;
    verifyEmail: jest.Mock;
    resendVerification: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      verifyEmail: jest.fn(),
      resendVerification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('register delegates to the service with the dto', async () => {
    const dto = { email: 'e@nexa.tn', password: 'x', nom: 'A', prenom: 'B' };
    authService.register.mockResolvedValue({ id: 'user-1' });

    const result = await controller.register(dto as any);

    expect(authService.register).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'user-1' });
  });

  it('login delegates to the service with the dto', async () => {
    const dto = { email: 'e@nexa.tn', password: 'x' };
    authService.login.mockResolvedValue({ access_token: 'signed' });

    const result = await controller.login(dto as any);

    expect(authService.login).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ access_token: 'signed' });
  });

  it('forgotPassword delegates to the service with the dto', async () => {
    const dto = { email: 'e@nexa.tn' };
    authService.forgotPassword.mockResolvedValue({ message: 'ok' });

    await controller.forgotPassword(dto as any);

    expect(authService.forgotPassword).toHaveBeenCalledWith(dto);
  });

  it('resetPassword delegates to the service with the dto', async () => {
    const dto = { token: 'abc', newPassword: 'newpass123' };
    authService.resetPassword.mockResolvedValue({ message: 'ok' });

    await controller.resetPassword(dto as any);

    expect(authService.resetPassword).toHaveBeenCalledWith(dto);
  });

  it('verifyEmail delegates to the service with the dto', async () => {
    const dto = { token: 'abc' };
    authService.verifyEmail.mockResolvedValue({ message: 'ok' });

    await controller.verifyEmail(dto as any);

    expect(authService.verifyEmail).toHaveBeenCalledWith(dto);
  });

  it('resendVerification delegates to the service with the dto', async () => {
    const dto = { email: 'e@nexa.tn' };
    authService.resendVerification.mockResolvedValue({ message: 'ok' });

    await controller.resendVerification(dto as any);

    expect(authService.resendVerification).toHaveBeenCalledWith(dto);
  });
});
