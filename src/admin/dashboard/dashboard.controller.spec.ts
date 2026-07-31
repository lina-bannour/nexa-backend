import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: { getStats: jest.Mock; getAnalytics: jest.Mock };

  beforeEach(async () => {
    service = { getStats: jest.fn(), getAnalytics: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: service }],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getStats delegates to the service', async () => {
    service.getStats.mockResolvedValue({ kpis: {} });

    const result = await controller.getStats();

    expect(service.getStats).toHaveBeenCalled();
    expect(result).toEqual({ kpis: {} });
  });

  // Regression test: this route was missing entirely on the controller for
  // a while even though DashboardService.getAnalytics() existed, so the
  // admin "Analytics" tab always failed to load (404).
  it('getAnalytics delegates to the service', async () => {
    service.getAnalytics.mockResolvedValue({ exercisePerformance: {} });

    const result = await controller.getAnalytics();

    expect(service.getAnalytics).toHaveBeenCalled();
    expect(result).toEqual({ exercisePerformance: {} });
  });
});
