import { Mapper } from "../Map/Mapper.js";
import Memory from "../Memory/Memory.js";

export class World {
    constructor() {
        this.memory = new Memory("Example");
        this.mapper = new Mapper(Mapper.defaultWoxel());
        this.memoryReady = this.loadMemory();
        this.map = null;
        this.chunkVisibility = null;
    }

    async loadMemory() {
        const woxelData = await this.memory.loadWoxel();

        if (!woxelData) return;

        // A loaded .woxel is world truth.
        // Never keep Mapper.defaultWoxel() when a real map exists.
        this.mapper = new Mapper({
            ...Mapper.defaultWoxel(),
            ...woxelData,
            boxels: woxelData.boxels || []
        });

        this.mapper.loadPatches(woxelData);
    }

    async ready() {
        await this.memoryReady;
    }

    build() {
        this.map = this.mapper.build();

        return this.map;
    }

    setChunkVisibility(chunkVisibility) {
        this.chunkVisibility = chunkVisibility;
        this.chunkVisibility?.setMeshes(this.map?.meshes || []);
    }

    hitVoxel(hit) {
        return this.mapper.hitVoxel(hit);
    }

    placeHit(hit, voxel) {
        return this.mapper.placeHit(hit, voxel);
    }

    removeHit(hit) {
        return this.mapper.removeHit(hit);
    }

    placeBoxel(boxel, anchor) {
        return this.mapper.placeBoxel(boxel, anchor);
    }

    toRenderPosition(position) {
        return this.mapper.toRenderPosition(position);
    }

    hasVoxel(position) {
        return this.mapper.isSolidAt(position);
    }

    refreshBoxels(boxels, player) {
        this.chunkVisibility?.remeshBoxels(boxels, player);
    }

    save(player = null, worldChanged = false) {
        if (worldChanged) this.memory.saveWoxel(this.mapper.woxel, this.mapper.patchData());
        this.memory.savePlayer(player);
    }

    exportWoxel() {
        return this.memory.exportWoxelFile(this.mapper.woxel, this.mapper.patchData());
    }

    async importWoxel(file) {
        return this.memory.importWoxelFile(file);
    }

    async loadPlayer() {
        return this.memory.loadPlayer();
    }

    async loadBoxel(name = "") {
        return this.memory.loadBoxel(name);
    }

    async saveBoxel(name = "", boxel) {
        return this.memory.saveBoxel(name, boxel);
    }

    async clearMemory() {
        await this.memory.clearWorld();
    }
}

export default World;

