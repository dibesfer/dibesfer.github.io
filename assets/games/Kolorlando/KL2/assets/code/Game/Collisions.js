import * as THREE from "three";

export class Collisions {
    constructor({ mapper, borders = [], scene = null, radius = 0.35, height = 1.8, debug = false } = {}) {
        this.mapper = mapper;
        this.borders = borders;
        this.scene = scene;
        this.radius = radius;
        this.height = height;
        this.debug = debug;
        this.helper = this.createPlayerHelper();
        this.lastGeneratedLandPosition = null;
        this.floorSnapLimit = 0.12;
        if (this.debug) this.scene?.add(this.helper);
    }

    createPlayerHelper() {
        const mesh = new THREE.Mesh(
            new THREE.CapsuleGeometry(this.radius, this.height - this.radius * 2, 4, 8),
            new THREE.MeshBasicMaterial({ color: 0xffff66, wireframe: true })
        );

        mesh.name = "PlayerCollisionCapsule";
        mesh.position.y = this.height / 2;
        mesh.visible = this.debug;

        return mesh;
    }

    update(player) {
        if (!player || !this.mapper) return;
        if (player.noclip) return;

        this.resolvePlayer(player);
        if (this.debug) this.drawPlayer(player);
    }

    resolvePlayer(player) {
        const previousPosition = player.previousPosition?.clone?.() || player.position.clone();

        this.resolveBorders(player);
        const blockedByUngeneratedLand = this.resolveUngeneratedLand(player);

        if (!blockedByUngeneratedLand) {
            const nearby = this.solidVoxelPositionsForSweptPlayer(previousPosition, player.position)
                .map(position => ({ position }));

            this.resolveVertical(player, previousPosition, nearby);
            this.resolveHorizontalAxis(player, previousPosition, nearby, "x");
            this.resolveHorizontalAxis(player, previousPosition, nearby, "z");
            this.resolveRemainingOverlap(player, previousPosition);
        }

        this.resolveBorders(player);
        this.rememberGeneratedLandPosition(player);
    }

    resolveUngeneratedLand(player) {
        if (!this.mapper.isUngeneratedLandColumn?.(player.position)) return false;
        if (!this.lastGeneratedLandPosition) return false;

        player.setPosition(
            this.lastGeneratedLandPosition.x,
            player.position.y,
            this.lastGeneratedLandPosition.z
        );

        return true;
    }

    rememberGeneratedLandPosition(player) {
        if (this.mapper.isUngeneratedLandColumn?.(player.position)) return;

        this.lastGeneratedLandPosition = player.position.clone();
    }

    resolveBorders(player) {
        this.borders.forEach(border => {
            const margin = this.borderMargin(border);
            const limit = border.value + (border.side === "min" ? margin : -margin);
            const value = player.position[border.axis];

            if (border.side === "min" && value < limit) {
                player.setPositionAxis(border.axis, limit);
            }

            if (border.side === "max" && value > limit) {
                player.setPositionAxis(border.axis, limit);
            }
        });
    }

    borderMargin(border) {
        if (border.axis !== "y") return this.radius;

        return border.side === "min" ? 0 : this.height;
    }

    resolveVertical(player, previousPosition, nearby) {
        const current = player.position;
        const movedUp = current.y > previousPosition.y;
        const movedDown = current.y < previousPosition.y;
        let ceilingY = null;
        let floorY = null;

        nearby.forEach(voxel => {
            const center = this.mapper.toRenderPosition(voxel.position);
            if (!this.playerOverlapsVoxelColumn(current, center)) return;

            const minY = center.y - 0.5;
            const maxY = center.y + 0.5;
            const previousMinY = previousPosition.y;
            const previousMaxY = previousPosition.y + this.height;
            const currentMinY = current.y;
            const currentMaxY = current.y + this.height;

            if (player.verticalVelocity > 0 && currentMinY < minY && currentMaxY > minY) {
                const y = minY - this.height;
                ceilingY = ceilingY === null ? y : Math.min(ceilingY, y);
            }

            if (movedUp && previousMaxY <= minY && currentMaxY > minY) {
                const y = minY - this.height;
                ceilingY = ceilingY === null ? y : Math.min(ceilingY, y);
            }

            if (movedDown && previousMinY >= maxY && currentMinY < maxY) {
                floorY = floorY === null ? maxY : Math.max(floorY, maxY);
            }

            if (!movedUp && currentMinY >= maxY && currentMinY - maxY <= this.floorSnapLimit) {
                floorY = floorY === null ? maxY : Math.max(floorY, maxY);
            }
        });

        if (ceilingY !== null) {
            if (player.hitCeiling) player.hitCeiling(ceilingY);
            else player.setPosition(current.x, ceilingY, current.z);
            return;
        }

        if (floorY !== null) {
            if (player.land) player.land(floorY);
            else player.setPosition(current.x, floorY, current.z);
        }
    }

    resolveHorizontalAxis(player, previousPosition, nearby, axis) {
        if (player.position[axis] === previousPosition[axis]) return;

        const blockedAt = this.horizontalBlockPosition(player, previousPosition, nearby, axis);

        if (blockedAt === null) return;

        player.setPositionAxis(axis, blockedAt);
    }

    resolveRemainingOverlap(player, previousPosition) {
        if (!this.playerOverlapsSolid(player.position)) return;

        player.setPosition(previousPosition.x, player.position.y, previousPosition.z);
        if (!this.playerOverlapsSolid(player.position)) return;

        player.setPosition(previousPosition.x, previousPosition.y, previousPosition.z);
        if (player.verticalVelocity > 0) player.hitCeiling?.(player.position.y);
        else if (player.verticalVelocity < 0) player.land?.(player.position.y);
    }

    horizontalBlockPosition(player, previousPosition, nearby, axis) {
        const current = player.position;
        const direction = current[axis] > previousPosition[axis] ? 1 : -1;
        const otherAxis = axis === "x" ? "z" : "x";
        let blockedAt = null;

        nearby.forEach(voxel => {
            const center = this.mapper.toRenderPosition(voxel.position);
            if (!this.playerSweptYOverlapsVoxel(previousPosition, current, center)) return;
            if (!this.axisRangeOverlapsVoxel(
                previousPosition[otherAxis],
                current[otherAxis],
                center[otherAxis]
            )) return;

            const min = center[axis] - 0.5 - this.radius;
            const max = center[axis] + 0.5 + this.radius;

            if (direction > 0 && previousPosition[axis] <= min && current[axis] > min) {
                blockedAt = blockedAt === null ? min : Math.min(blockedAt, min);
            }

            if (direction < 0 && previousPosition[axis] >= max && current[axis] < max) {
                blockedAt = blockedAt === null ? max : Math.max(blockedAt, max);
            }
        });

        return blockedAt;
    }

    playerSweptYOverlapsVoxel(previousPosition, currentPosition, center) {
        const minY = center.y - 0.5;
        const maxY = center.y + 0.5;
        const playerMinY = Math.min(previousPosition.y, currentPosition.y);
        const playerMaxY = Math.max(previousPosition.y + this.height, currentPosition.y + this.height);

        return playerMaxY > minY && playerMinY < maxY;
    }

    axisRangeOverlapsVoxel(previousValue, currentValue, centerValue) {
        const min = Math.min(previousValue, currentValue);
        const max = Math.max(previousValue, currentValue);

        return max > centerValue - 0.5 - this.radius
            && min < centerValue + 0.5 + this.radius;
    }

    playerOverlapsVoxelAt(playerPosition, voxelPosition) {
        const center = this.mapper.toRenderPosition(voxelPosition);
        const minY = center.y - 0.5;
        const maxY = center.y + 0.5;
        const playerMinY = playerPosition.y;
        const playerMaxY = playerPosition.y + this.height;

        if (playerMaxY <= minY || playerMinY >= maxY) return false;

        return this.playerOverlapsVoxelColumn(playerPosition, center);
    }

    playerOverlapsVoxelColumn(playerPosition, center) {
        const closestX = THREE.MathUtils.clamp(playerPosition.x, center.x - 0.5, center.x + 0.5);
        const closestZ = THREE.MathUtils.clamp(playerPosition.z, center.z - 0.5, center.z + 0.5);
        const dx = playerPosition.x - closestX;
        const dz = playerPosition.z - closestZ;

        return dx * dx + dz * dz < this.radius * this.radius;
    }

    playerOverlapsVoxel(player, voxelPosition) {
        if (!player || !voxelPosition) return false;
        if (player.noclip) return false;

        return this.playerOverlapsVoxelAt(player.position, voxelPosition);
    }

    playerOverlapsSolid(playerPosition) {
        return this.solidVoxelPositionsForPlayer(playerPosition)
            .some(position => this.playerOverlapsVoxelAt(playerPosition, position));
    }

    solidVoxelPositionsForPlayer(playerPosition) {
        const min = this.toVoxelPosition({
            x: playerPosition.x - this.radius,
            y: playerPosition.y,
            z: playerPosition.z - this.radius
        });
        const max = this.toVoxelPosition({
            x: playerPosition.x + this.radius,
            y: playerPosition.y + this.height,
            z: playerPosition.z + this.radius
        });
        const positions = [];

        for (let x = min.x; x <= max.x; x += 1) {
            for (let y = min.y; y <= max.y; y += 1) {
                for (let z = min.z; z <= max.z; z += 1) {
                    const position = { x, y, z };
                    if (this.mapper.isSolidAt(position)) positions.push(position);
                }
            }
        }

        return positions;
    }

    solidVoxelPositionsForSweptPlayer(previousPosition, currentPosition) {
        const minRender = {
            x: Math.min(previousPosition.x, currentPosition.x) - this.radius,
            y: Math.min(previousPosition.y, currentPosition.y),
            z: Math.min(previousPosition.z, currentPosition.z) - this.radius
        };
        const maxRender = {
            x: Math.max(previousPosition.x, currentPosition.x) + this.radius,
            y: Math.max(previousPosition.y, currentPosition.y) + this.height,
            z: Math.max(previousPosition.z, currentPosition.z) + this.radius
        };
        const min = this.toVoxelPosition(minRender);
        const max = this.toVoxelPosition(maxRender);
        const positions = [];

        for (let x = min.x; x <= max.x; x += 1) {
            for (let y = min.y; y <= max.y; y += 1) {
                for (let z = min.z; z <= max.z; z += 1) {
                    const position = { x, y, z };
                    if (this.mapper.isSolidAt(position)) positions.push(position);
                }
            }
        }

        return positions;
    }

    toVoxelPosition(position) {
        return this.mapper.toVoxelPosition(position);
    }

    drawPlayer(player) {
        this.helper.position.copy(player.position);
        this.helper.position.y += this.height / 2;
    }
}

export default Collisions;
