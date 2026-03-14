/**
 * ReferenceCognitiveRegistry — A simple in-process registry for cognitive modules.
 *
 * This is the brain stem of the cognitive architecture. It manages the lifecycle
 * of cognitive modules (Sensors, Processors, Actuators, Memory) and enables
 * graceful degradation when modules fail.
 *
 * Key features:
 * - Register/discover modules by capability
 * - Graceful degradation: missing modules don't crash the system
 * - Centralized initialization and cleanup
 *
 * Design: intentionally simple (in-process, synchronous registry). Production
 * systems may replace this with distributed service discovery, etc.
 *
 * @see DEC-003 — Capability-based Modular Architecture
 */

import type { 
    CognitiveRegistry, 
    CognitiveModule, 
    CognitiveBus,
    CognitiveCapability 
} from '@ami/skeleton';

export class ReferenceCognitiveRegistry implements CognitiveRegistry {
    private modules = new Map<string, CognitiveModule>();
    private bus: CognitiveBus;

    constructor(bus: CognitiveBus) {
        this.bus = bus;
    }

    register(module: CognitiveModule): void {
        if (this.modules.has(module.id)) {
            throw new Error(`Module "${module.id}" is already registered`);
        }

        console.log(`[Registry] Registering module: ${module.name} (${module.id}) - capabilities: ${module.capabilities.join(', ')}`);
        this.modules.set(module.id, module);
        module.status = 'registered';

        // Emit registration event so other modules can react
        this.bus.emit('module.registered', { 
            moduleId: module.id, 
            name: module.name, 
            capabilities: module.capabilities 
        });
    }

    async initAll(config: Record<string, unknown> = {}): Promise<void> {
        console.log(`[Registry] Initializing ${this.modules.size} modules...`);

        const initPromises = Array.from(this.modules.values()).map(async (module) => {
            try {
                module.status = 'initializing';
                console.log(`[Registry] Initializing ${module.name}...`);
                
                await module.init(this.bus, (config[module.id] as Record<string, unknown>) || {});
                
                module.status = 'ready';
                console.log(`[Registry] ✓ ${module.name} ready`);
                
                // Notify system that module is ready
                this.bus.emit('module.ready', { 
                    moduleId: module.id, 
                    name: module.name,
                    capabilities: module.capabilities 
                });
            } catch (error) {
                module.status = 'error';
                console.error(`[Registry] ✗ ${module.name} failed to initialize:`, error);
                
                // Emit degraded status instead of crashing
                this.bus.emit('module.unavailable', { 
                    moduleId: module.id, 
                    name: module.name,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Wait for all initialization attempts (successful and failed)
        await Promise.allSettled(initPromises);
        
        const readyCount = this.getReadyModules().length;
        const totalCount = this.modules.size;
        
        console.log(`[Registry] Initialization complete: ${readyCount}/${totalCount} modules ready`);
    }

    async destroyAll(): Promise<void> {
        console.log(`[Registry] Shutting down ${this.modules.size} modules...`);

        const destroyPromises = Array.from(this.modules.values()).map(async (module) => {
            if (module.status === 'ready' || module.status === 'degraded') {
                try {
                    console.log(`[Registry] Shutting down ${module.name}...`);
                    await module.destroy();
                    module.status = 'stopped';
                    console.log(`[Registry] ✓ ${module.name} stopped`);
                } catch (error) {
                    console.error(`[Registry] Error shutting down ${module.name}:`, error);
                    module.status = 'error';
                }
            }
        });

        await Promise.allSettled(destroyPromises);
        console.log(`[Registry] All modules shut down`);
    }

    getModule(id: string): CognitiveModule | undefined {
        return this.modules.get(id);
    }

    getProviders(capability: CognitiveCapability): CognitiveModule[] {
        return Array.from(this.modules.values()).filter(module => 
            module.capabilities.includes(capability) && 
            module.status === 'ready'
        );
    }

    hasCapability(capability: CognitiveCapability): boolean {
        return this.getProviders(capability).length > 0;
    }

    /**
     * Get all modules that are currently ready to use.
     */
    getReadyModules(): CognitiveModule[] {
        return Array.from(this.modules.values()).filter(module => 
            module.status === 'ready'
        );
    }

    /**
     * Get all modules that failed to initialize or are degraded.
     */
    getDegradedModules(): CognitiveModule[] {
        return Array.from(this.modules.values()).filter(module => 
            module.status === 'degraded' || module.status === 'error'
        );
    }

    /**
     * Get registry status summary.
     */
    getStatus(): { 
        totalModules: number;
        readyModules: number;
        degradedModules: number;
        availableCapabilities: CognitiveCapability[];
    } {
        const ready = this.getReadyModules();
        const degraded = this.getDegradedModules();
        
        // Collect all unique capabilities from ready modules
        const capabilities = new Set<CognitiveCapability>();
        ready.forEach(module => {
            module.capabilities.forEach(cap => capabilities.add(cap));
        });

        return {
            totalModules: this.modules.size,
            readyModules: ready.length,
            degradedModules: degraded.length,
            availableCapabilities: Array.from(capabilities)
        };
    }
}