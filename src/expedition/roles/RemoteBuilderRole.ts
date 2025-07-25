// 远程建造角色 - 阶段3：建造Spawn等关键建筑

import {ExpeditionRole} from '../core/ExpeditionRole';
import {MissionPhase} from '../core/ExpeditionStates';

export const ROLE_REMOTE_BUILDER = 'remoteBuilder';

export class RemoteBuilderRole extends ExpeditionRole {

    protected doWork(): void {
        const room = this.creep.room;
        if (!room) {
            this.log('无法访问目标房间，等待房间可见');
            return;
        }

        const controller = room.controller;
        if (!controller || !controller.my || controller.level < 2) {
            this.log('控制器不存在、不属于己方或未达到RCL2，等待升级阶段完成');
            return;
        }

        // 检查是否已有Spawn
        // const existingSpawn = room.find(FIND_MY_SPAWNS)[0];
        // if (existingSpawn) {
        //     this.log('Spawn已建成，建造阶段完成');
        //     return;
        // }

        // 执行批量工作循环：满载采集 -> 满载建造
        const STATE_BUILD = "build";
        const STATE_HARVEST = "harvest";
        if (this.creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
            // store满载，去建造直到耗尽
            this.creep.memory.workState = STATE_BUILD;
            this.doBuild();
        } else if (this.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            // store空载，去采集直到满载
            this.creep.memory.workState = STATE_HARVEST;
            this.collectEnergy();
        }
        if (this.creep.memory.workState === STATE_HARVEST) this.collectEnergy();
        else if (this.creep.memory.workState === STATE_BUILD) this.doBuild();
        else this.creep.memory.workState = STATE_HARVEST;// 状态不对，初始化状态
    }

    private collectEnergy(): void {
        // 优先从废墟收集能量
        const ruin = this.creep.pos.findClosestByPath(FIND_RUINS, {
            filter: ruin => ruin.store.getUsedCapacity(RESOURCE_ENERGY) > 0
        });

        if (ruin) {
            const result = this.creep.withdraw(ruin, RESOURCE_ENERGY);
            if (result === ERR_NOT_IN_RANGE) {
                this.creep.moveTo(ruin, {
                    visualizePathStyle: {stroke: '#ffff00', lineStyle: 'solid', opacity: 0.8}
                });
            }
            return;
        }

        // 其次从墓碑收集能量
        const tombstone = this.creep.pos.findClosestByPath(FIND_TOMBSTONES, {
            filter: tomb => tomb.store.getUsedCapacity(RESOURCE_ENERGY) > 0
        });

        if (tombstone) {
            const result = this.creep.withdraw(tombstone, RESOURCE_ENERGY);
            if (result === ERR_NOT_IN_RANGE) {
                this.creep.moveTo(tombstone, {
                    visualizePathStyle: {stroke: '#ffff00', lineStyle: 'solid', opacity: 0.8}
                });
            }
            return;
        }

        // 从地面资源收集
        const droppedEnergy = this.creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
            filter: resource => resource.resourceType === RESOURCE_ENERGY
        });

        if (droppedEnergy) {
            const result = this.creep.pickup(droppedEnergy);
            if (result === ERR_NOT_IN_RANGE) {
                this.creep.moveTo(droppedEnergy, {
                    visualizePathStyle: {stroke: '#ffff00', lineStyle: 'solid', opacity: 0.8}
                });
            }
            return;
        }

        // 最后从能量点采集
        const source = this.creep.pos.findClosestByPath(FIND_SOURCES, {
            filter: source => source.energy > 0
        });

        if (source) {
            const result = this.creep.harvest(source);
            if (result === ERR_NOT_IN_RANGE) {
                this.creep.moveTo(source, {
                    visualizePathStyle: {stroke: '#ffff00', lineStyle: 'solid', opacity: 0.8}
                });
            }
        }
    }

    private doBuild(): void {
        // 优先建造Spawn
        const spawnSite = this.creep.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES, {
            filter: site => site.structureType === STRUCTURE_SPAWN
        });

        if (spawnSite) {
            const result = this.creep.build(spawnSite);
            if (result === ERR_NOT_IN_RANGE) {
                this.creep.moveTo(spawnSite, {
                    visualizePathStyle: {stroke: '#00ffff', lineStyle: 'solid', opacity: 0.8}
                });
            } else if (result === OK) {
                this.log(`建造Spawn中，进度: ${spawnSite.progress}/${spawnSite.progressTotal}`);
            }
            return;
        }

        // 建造其他优先建筑（Extension等）
        const prioritySite = this.creep.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES, {
            filter: site => ([STRUCTURE_EXTENSION, STRUCTURE_CONTAINER] as StructureConstant[]).includes(site.structureType)
        });

        if (prioritySite) {
            const result = this.creep.build(prioritySite);
            if (result === ERR_NOT_IN_RANGE) {
                this.creep.moveTo(prioritySite, {
                    visualizePathStyle: {stroke: '#00ffff', lineStyle: 'solid', opacity: 0.8}
                });
            }
            return;
        }

        // 建造任意建筑
        const anySite = this.creep.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES);
        if (anySite) {
            const result = this.creep.build(anySite);
            if (result === ERR_NOT_IN_RANGE) {
                this.creep.moveTo(anySite, {
                    visualizePathStyle: {stroke: '#00ffff', lineStyle: 'solid', opacity: 0.8}
                });
            }
        } else {
            this.log('没有找到建设点，等待规划');
        }
    }

    protected onArrivedAtTarget(): void {
        super.onArrivedAtTarget();
        this.log('开始执行房间建造任务，优先建造Spawn');
    }

    protected onNearDeath(): void {
        super.onNearDeath();
        this.log('建造者即将死亡，需要派遣继任者');
    }

    // 创建远程建造者的静态方法
    static spawn(spawn: StructureSpawn, targetRoom: string): ScreepsReturnCode {
        const name = `remoteBuilder_${Game.time}`;
        const body = RemoteBuilderRole.getOptimalBody(spawn);

        if (body.length === 0) {
            return ERR_NOT_ENOUGH_ENERGY;
        }

        return ExpeditionRole.spawnExpeditionCreep(
            spawn,
            name,
            body,
            targetRoom,
            MissionPhase.BUILDING,
            ROLE_REMOTE_BUILDER
        );
    }

    // 计算目标房间最优建造者数量（基于建筑工地需求）
    static calculateOptimalBuilderCount(room: Room | null, builderBodyParts: BodyPartConstant[], expeditionDistance?: number): number {
        if (!room) {
            console.log(`⚠️ 警告: 房间不存在，无法计算最优建造者数量，返回默认值0`);
            return 0; // 房间不可见时不生产建造者
        }

        if (!room.controller?.my || room.controller.level < 2) {
            console.log(`⚠️ 警告: 房间 ${room.name} 控制器不属于己方或未达到RCL2，建造阶段不应在此时调用`);
            return 0; // 房间条件不满足时不生产建造者
        }

        // 检查是否已有Spawn完成
        const existingSpawn = room.find(FIND_MY_SPAWNS)[0];
        if (existingSpawn) {
            console.log(`${room.name} 已有Spawn，建造阶段完成，停止生产建造者`);
            return 0; // Spawn已建成，不需要建造者
        }

        // 获取所有建筑工地
        const constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES);
        if (constructionSites.length === 0) {
            console.log(`${room.name} 没有建筑工地，暂不需要建造者`);
            return 0; // 没有工地时不需要建造者
        }

        // 计算建造者的工作能力
        const workParts = builderBodyParts.filter(part => part === WORK).length;
        const buildPowerPerCreep = workParts * 5; // 每个WORK部件每tick建造5点进度
        const harvestPowerPerCreep = workParts * 2; // 每个WORK部件每tick采集2能量

        // 分析能量矿的采集能力限制
        const sources = room.find(FIND_SOURCES);
        let totalHarvestCapacity = 0; // 总的采集能力上限

        for (const source of sources) {
            // 分析能量矿周围的可用位置（复用升级者的逻辑）
            const accessiblePositions = this.getAccessiblePositionsAroundSource(room, source);
            const maxCreepsAtSource = accessiblePositions.length;

            // 计算能量矿的产出速度（能量/tick）
            const sourceRegenRate = source.energyCapacity / 300; // 300tick恢复周期

            // 计算这个矿能支持多少建造者同时采集
            const maxBuildersAtSource = Math.min(
                Math.ceil(sourceRegenRate / harvestPowerPerCreep), // 基于采集能力
                maxCreepsAtSource // 受位置限制
            );

            totalHarvestCapacity += maxBuildersAtSource;
            console.log(`能量矿 ${source.pos}: 可用位置${maxCreepsAtSource}, 产出${sourceRegenRate.toFixed(1)}/tick, 最多支持${maxBuildersAtSource}个建造者采集`);
        }

        // 计算总建造工作量
        let totalBuildWork = 0;
        let spawnSiteCount = 0;
        let prioritySiteCount = 0;
        let otherSiteCount = 0;

        for (const site of constructionSites) {
            const remainingWork = site.progressTotal - site.progress;
            totalBuildWork += remainingWork;

            if (site.structureType === STRUCTURE_SPAWN) {
                spawnSiteCount++;
            } else if (([STRUCTURE_EXTENSION, STRUCTURE_CONTAINER] as StructureConstant[]).includes(site.structureType)) {
                prioritySiteCount++;
            } else {
                otherSiteCount++;
            }
        }

        console.log(`${room.name} 建筑工地分析: Spawn${spawnSiteCount}个, 优先建筑${prioritySiteCount}个, 其他${otherSiteCount}个, 总工作量${totalBuildWork}`);
        console.log(`${room.name} 采集能力限制: 最多支持${totalHarvestCapacity}个建造者同时采集`);

        // 基于工作量计算理论建造者数量
        // 假设希望在500tick内完成所有建造工作
        const targetCompletionTicks = 500;
        const workBasedBuilders = Math.ceil(totalBuildWork / (buildPowerPerCreep * targetCompletionTicks));

        // 理论建造者数量不能超过采集能力限制
        const theoreticalBuilders = Math.min(workBasedBuilders, totalHarvestCapacity);

        // 应用实际运营修正因子
        const practicalCount = this.applyBuilderPracticalModifiers(theoreticalBuilders, expeditionDistance || 1, constructionSites.length);

        if (workBasedBuilders > totalHarvestCapacity) {
            console.log(`${room.name} 建造者受采集能力限制: 工作量需要${workBasedBuilders}个 -> 采集限制${totalHarvestCapacity}个`);
        }

        console.log(`${room.name} 建造者计算: 理论${theoreticalBuilders}个 -> 实际${practicalCount}个 (工作量${totalBuildWork}, 工地${constructionSites.length}个)`);

        return practicalCount;
    }

    // 应用建造者实际运营修正因子
    private static applyBuilderPracticalModifiers(theoreticalCount: number, expeditionDistance: number, siteCount: number): number {
        if (theoreticalCount === 0) return 0;

        // 1. 工作效率因子 (0.5-0.7)
        // 建造者需要在采集能量和建造之间切换，效率比升级者更低
        const workEfficiencyFactor = 0.6; // 假设60%时间用于建造，40%用于采集和移动

        // 2. 远征距离因子 (基于距离的额外需求)
        // Builder寿命1500tick比Claimer的600tick长很多，距离影响较小
        const distanceFactor = Math.min(1 + (expeditionDistance - 1) * 0.03, 1.3); // 每房间增加3%，最多30%

        // 3. 生命周期重叠因子 
        const lifecycleOverlapFactor = 1.2; // 20%的重叠缓冲（建造者死亡影响小于升级者）

        // 4. 建筑工地分散因子
        // 工地越多越分散，需要更多建造者避免拥挤
        const siteFactor = Math.min(1 + siteCount * 0.1, 2.0); // 每个工地增加10%，最多100%

        // 5. 最小建造者数量保证
        // 至少要有1个建造者来处理Spawn建设
        const minBuilders = 1;

        // 应用所有修正因子
        const adjustedCount = Math.max(
            minBuilders,
            Math.ceil(theoreticalCount / workEfficiencyFactor * distanceFactor * lifecycleOverlapFactor * siteFactor)
        );

        console.log(`建造者修正因子: 工作效率${(1 / workEfficiencyFactor).toFixed(2)}x, 距离${distanceFactor.toFixed(2)}x, 生命周期${lifecycleOverlapFactor.toFixed(2)}x, 工地分散${siteFactor.toFixed(2)}x`);

        return adjustedCount;
    }

    // 获取能量矿周围的可访问位置（复用升级者的逻辑）
    private static getAccessiblePositionsAroundSource(room: Room, source: Source): RoomPosition[] {
        const positions: RoomPosition[] = [];

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue; // 跳过能量矿自身位置

                const x = source.pos.x + dx;
                const y = source.pos.y + dy;

                // 检查位置是否在房间范围内
                if (x < 1 || x > 48 || y < 1 || y > 48) continue;

                const pos = new RoomPosition(x, y, room.name);

                // 检查地形是否可通行
                const terrain = room.getTerrain().get(x, y);
                if (terrain === TERRAIN_MASK_WALL) continue;

                // 检查是否有阻挡的建筑物（不包括道路、容器等可通行建筑）
                const structures = pos.lookFor(LOOK_STRUCTURES);
                const hasBlockingStructure = structures.some(structure =>
                    structure.structureType !== STRUCTURE_ROAD &&
                    structure.structureType !== STRUCTURE_CONTAINER &&
                    structure.structureType !== STRUCTURE_RAMPART
                );

                if (!hasBlockingStructure) {
                    positions.push(pos);
                }
            }
        }

        return positions;
    }

    // 获取最佳身体配置 - 平衡移动和建造能力
    static getOptimalBody(spawn: StructureSpawn): BodyPartConstant[] {
        const room = spawn.room;
        const availableEnergy = room.energyCapacityAvailable;

        const bodies = [
            // 超高速配置：3 WORK + 4 CARRY + 10 MOVE = 1100 能量 (1格/tick移动)
            {
                energy: 1100,
                parts: [WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE],
                speed: '1.0格/tick',
                travelTime: '17房间约850tick'
            },
            // 高速配置：2 WORK + 3 CARRY + 7 MOVE = 800 能量 (1格/tick移动)
            {
                energy: 800,
                parts: [WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE],
                speed: '1.0格/tick',
                travelTime: '17房间约850tick'
            },
            // 中速配置：2 WORK + 2 CARRY + 5 MOVE = 650 能量 (0.8格/tick移动)
            {
                energy: 650,
                parts: [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE],
                speed: '0.8格/tick',
                travelTime: '17房间约1050tick'
            },
            // 基本配置：1 WORK + 2 CARRY + 4 MOVE = 500 能量 (0.75格/tick移动)
            {
                energy: 500,
                parts: [WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE],
                speed: '0.75格/tick',
                travelTime: '17房间约1150tick'
            },
            // 最低配置：1 WORK + 1 CARRY + 3 MOVE = 350 能量 (0.6格/tick移动)
            {
                energy: 350,
                parts: [WORK, CARRY, MOVE, MOVE, MOVE],
                speed: '0.6格/tick',
                travelTime: '17房间约1400tick'
            }
        ];

        for (const bodyConfig of bodies) {
            if (availableEnergy >= bodyConfig.energy) {
                console.log(`远程建造者使用配置: ${bodyConfig.parts.join(',')} (${bodyConfig.energy} 能量)`);
                console.log(`  移动速度: ${bodyConfig.speed}, 预计到达时间: ${bodyConfig.travelTime}`);
                return bodyConfig.parts;
            }
        }

        return [];
    }
}