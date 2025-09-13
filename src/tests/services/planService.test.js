/**
 * Plan Service Tests
 */

const planService = require('../../services/planService');
const { supabase } = require('../../config/supabase');

describe('Plan Service', () => {
  beforeEach(() => {
    global.testUtils.resetMocks();
  });

  describe('getPlans', () => {
    it('should return paginated plans', async () => {
      // Setup
      const mockPlans = [global.testUtils.mockPlan];
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              range: jest.fn().mockResolvedValue({
                data: mockPlans,
                error: null,
                count: 1
              })
            })
          })
        })
      });

      // Execute
      const result = await planService.getPlans();

      // Assert
      expect(result).toEqual({
        plans: mockPlans,
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          pages: 1
        }
      });
      expect(supabase.from).toHaveBeenCalledWith('plans');
    });

    it('should filter by active status', async () => {
      // Setup
      const mockQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              range: jest.fn().mockResolvedValue({
                data: [],
                error: null,
                count: 0
              })
            })
          })
        })
      };
      supabase.from.mockReturnValue(mockQuery);

      // Execute
      await planService.getPlans({ is_active: true });

      // Assert
      expect(mockQuery.select).toHaveBeenCalled();
      expect(mockQuery.select().eq).toHaveBeenCalledWith('is_active', true);
    });

    it('should handle database errors', async () => {
      // Setup
      global.testUtils.simulateDbError('Plans not found');

      // Execute & Assert
      await expect(planService.getPlans()).rejects.toThrow('Plans not found');
    });

    it('should apply pagination correctly', async () => {
      // Setup
      const mockQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              range: jest.fn().mockResolvedValue({
                data: [],
                error: null,
                count: 0
              })
            })
          })
        })
      };
      supabase.from.mockReturnValue(mockQuery);

      // Execute
      await planService.getPlans({ page: 2, limit: 5 });

      // Assert
      expect(mockQuery.select().eq().order().range).toHaveBeenCalledWith(5, 9);
    });
  });

  describe('getPlanById', () => {
    it('should return plan by ID', async () => {
      // Setup
      const mockPlan = global.testUtils.mockPlan;
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockPlan,
              error: null
            })
          })
        })
      });

      // Execute
      const result = await planService.getPlanById(mockPlan.id);

      // Assert
      expect(result).toEqual(mockPlan);
      expect(supabase.from).toHaveBeenCalledWith('plans');
    });

    it('should return null for non-existent plan', async () => {
      // Setup
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' } // Not found
            })
          })
        })
      });

      // Execute
      const result = await planService.getPlanById('non-existent-id');

      // Assert
      expect(result).toBeNull();
    });

    it('should throw error for database issues', async () => {
      // Setup
      global.testUtils.simulateDbError('Database connection failed');

      // Execute & Assert
      await expect(planService.getPlanById('test-id')).rejects.toThrow('Database connection failed');
    });
  });

  describe('createPlan', () => {
    it('should create new plan successfully', async () => {
      // Setup
      const planData = {
        name: 'New Plan',
        description: 'A new test plan',
        price: 19.99,
        billing_cycle: 'monthly',
        features: ['Feature 1'],
        limits: { projects: 5 }
      };

      const createdPlan = { ...planData, id: 'new-plan-id' };

      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: createdPlan,
              error: null
            })
          })
        })
      });

      // Execute
      const result = await planService.createPlan(planData);

      // Assert
      expect(result).toEqual(createdPlan);
      expect(supabase.from).toHaveBeenCalledWith('plans');
    });

    it('should handle creation errors', async () => {
      // Setup
      const planData = { name: 'Test Plan' };
      global.testUtils.simulateDbError('Validation failed');

      // Execute & Assert
      await expect(planService.createPlan(planData)).rejects.toThrow('Validation failed');
    });
  });

  describe('updatePlan', () => {
    it('should update plan successfully', async () => {
      // Setup
      const planId = 'test-plan-id';
      const updateData = { name: 'Updated Plan Name' };
      const updatedPlan = { ...global.testUtils.mockPlan, ...updateData };

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: updatedPlan,
                error: null
              })
            })
          })
        })
      });

      // Execute
      const result = await planService.updatePlan(planId, updateData);

      // Assert
      expect(result).toEqual(updatedPlan);
      expect(supabase.from).toHaveBeenCalledWith('plans');
    });

    it('should throw error if plan not found', async () => {
      // Setup
      const planId = 'non-existent-plan';
      const updateData = { name: 'Updated Name' };

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
              })
            })
          })
        })
      });

      // Execute & Assert
      await expect(planService.updatePlan(planId, updateData)).rejects.toThrow('Plan not found');
    });
  });

  describe('deletePlan', () => {
    it('should soft delete plan successfully', async () => {
      // Setup
      const planId = 'test-plan-id';

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { ...global.testUtils.mockPlan, is_active: false },
                error: null
              })
            })
          })
        })
      });

      // Execute
      await planService.deletePlan(planId);

      // Assert
      expect(supabase.from).toHaveBeenCalledWith('plans');
    });

    it('should throw error if plan not found for deletion', async () => {
      // Setup
      const planId = 'non-existent-plan';

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
              })
            })
          })
        })
      });

      // Execute & Assert
      await expect(planService.deletePlan(planId)).rejects.toThrow('Plan not found');
    });
  });

  describe('searchPlans', () => {
    it('should search plans by name', async () => {
      // Setup
      const searchTerm = 'pro';
      const mockPlans = [global.testUtils.mockPlan];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          ilike: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: mockPlans,
                error: null
              })
            })
          })
        })
      });

      // Execute
      const result = await planService.searchPlans(searchTerm);

      // Assert
      expect(result).toEqual(mockPlans);
      expect(supabase.from).toHaveBeenCalledWith('plans');
    });

    it('should return empty array for no matches', async () => {
      // Setup
      const searchTerm = 'nonexistent';

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          ilike: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          })
        })
      });

      // Execute
      const result = await planService.searchPlans(searchTerm);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('comparePlans', () => {
    it('should compare multiple plans', async () => {
      // Setup
      const planIds = ['plan1', 'plan2'];
      const mockPlans = [
        { ...global.testUtils.mockPlan, id: 'plan1' },
        { ...global.testUtils.mockPlan, id: 'plan2', name: 'Plan 2' }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: mockPlans,
                error: null
              })
            })
          })
        })
      });

      // Execute
      const result = await planService.comparePlans(planIds);

      // Assert
      expect(result).toEqual({
        plans: mockPlans,
        comparison: {
          features: expect.any(Object),
          pricing: expect.any(Object),
          limits: expect.any(Object)
        }
      });
    });

    it('should handle empty plan IDs array', async () => {
      // Execute & Assert
      await expect(planService.comparePlans([])).rejects.toThrow('At least one plan ID is required');
    });
  });
});