import {closestHurtStructure, findHostileCreep} from "./role/utils/findUtils";
import {getRoomCenter} from "./utils/PositionUtils";

export class TowerController {
    constructor(private room: Room) {
    }

    run() {
        const hostileCreep = findHostileCreep(this.room);
        const towerArr = this.room.find(FIND_MY_STRUCTURES, {
            filter: it => it.structureType === STRUCTURE_TOWER
        });
        if (hostileCreep) {
            for (const tower of towerArr) {
                tower.attack(hostileCreep);
            }
            return
        }

        let roomCenter = getRoomCenter(this.room);

        const needHealCreep = roomCenter.findClosestByRange(FIND_MY_CREEPS, {
            filter: it => it.hits < it.hitsMax
        });
        if (needHealCreep) {
            for (const tower of towerArr) {
                tower.heal(needHealCreep);
            }
            return;
        }

        const needHealStructure = closestHurtStructure(roomCenter)
        if (needHealStructure) {
            for (const tower of towerArr) {
                tower.repair(needHealStructure);
            }
        }
    }
}